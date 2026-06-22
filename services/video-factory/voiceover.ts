import "server-only";

import { isFalConfigured } from "@/services/media/fal-config";
import { runFfmpeg } from "./ffmpeg";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

function readFalKey(): string | null {
  return process.env.FAL_KEY?.trim() ?? null;
}

/**
 * Generate voiceover audio. Uses fal TTS when configured; otherwise a silent
 * AAC track of the target duration so the assembler can mux reliably.
 */
export async function synthesizeVoiceover(opts: {
  scriptText: string;
  durationSeconds: number;
}): Promise<Buffer> {
  const falKey = readFalKey();
  if (isFalConfigured() && falKey && opts.scriptText.trim().length > 0) {
    try {
      return await falTts(opts.scriptText);
    } catch {
      // Fall through to silent track.
    }
  }
  return generateSilentAudio(opts.durationSeconds);
}

async function falTts(text: string): Promise<Buffer> {
  const falKey = readFalKey();
  if (!falKey) throw new Error("FAL_KEY missing");
  const model = process.env.AUTOSCALE_FAL_TTS_MODEL?.trim() || "fal-ai/minimax/speech-02-hd";
  const res = await fetch(`https://fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text: text.slice(0, 5000) }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    throw new Error(`fal TTS failed: ${res.status} ${await res.text()}`);
  }
  const data = (await res.json()) as { audio?: { url?: string }; audio_url?: string };
  const url = data.audio?.url ?? data.audio_url;
  if (!url) throw new Error("fal TTS returned no audio URL");
  const audioRes = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!audioRes.ok) throw new Error(`fal TTS download failed: ${audioRes.status}`);
  return Buffer.from(await audioRes.arrayBuffer());
}

async function generateSilentAudio(durationSeconds: number): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "autoscale-vo-"));
  const out = join(dir, "silent.m4a");
  try {
    await runFfmpeg([
      "-f",
      "lavfi",
      "-i",
      "anullsrc=r=44100:cl=mono",
      "-t",
      String(Math.max(1, durationSeconds)),
      "-c:a",
      "aac",
      "-b:a",
      "128k",
      out,
    ]);
    return await readFile(out);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}
