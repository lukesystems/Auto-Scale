import "server-only";

import { runFfmpeg } from "@/services/video-factory/ffmpeg";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type VoiceProviderId = "elevenlabs" | "openai" | "silent_dev_fallback";

export interface VoiceoverResult {
  buffer: Buffer;
  provider: VoiceProviderId;
  isSilent: boolean;
  qualityPenalty: number;
}

function configuredProvider(): VoiceProviderId {
  const env = (process.env.VOICE_PROVIDER ?? "elevenlabs").trim().toLowerCase();
  if (env === "openai") return "openai";
  if (env === "silent") return "silent_dev_fallback";
  return "elevenlabs";
}

export async function synthesizeWithProvider(opts: {
  scriptText: string;
  durationSeconds: number;
}): Promise<VoiceoverResult> {
  const text = opts.scriptText.trim();
  const order: VoiceProviderId[] = [];
  const primary = configuredProvider();
  order.push(primary);
  if (primary !== "openai" && process.env.OPENAI_API_KEY) order.push("openai");
  if (primary !== "elevenlabs" && process.env.ELEVENLABS_API_KEY) order.push("elevenlabs");
  order.push("silent_dev_fallback");

  const tried = new Set<VoiceProviderId>();
  for (const provider of order) {
    if (tried.has(provider)) continue;
    tried.add(provider);
    try {
      if (provider === "elevenlabs" && process.env.ELEVENLABS_API_KEY && text) {
        const buffer = await elevenLabsTts(text);
        return { buffer, provider, isSilent: false, qualityPenalty: 0 };
      }
      if (provider === "openai" && process.env.OPENAI_API_KEY && text) {
        const buffer = await openAiTts(text);
        return { buffer, provider, isSilent: false, qualityPenalty: 0 };
      }
      if (provider === "silent_dev_fallback") {
        const buffer = await silentAudio(opts.durationSeconds);
        return { buffer, provider, isSilent: true, qualityPenalty: 0.25 };
      }
    } catch {
      continue;
    }
  }

  const buffer = await silentAudio(opts.durationSeconds);
  return { buffer, provider: "silent_dev_fallback", isSilent: true, qualityPenalty: 0.25 };
}

async function elevenLabsTts(text: string): Promise<Buffer> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");
  const voiceId =
    process.env.DEFAULT_VOICE_ID?.trim() || "21m00Tcm4TlvDq8ikWAM";
  const res = await fetch(
    `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
    {
      method: "POST",
      headers: {
        "xi-api-key": apiKey,
        "Content-Type": "application/json",
        Accept: "audio/mpeg",
      },
      body: JSON.stringify({
        text: text.slice(0, 5000),
        model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
      }),
      signal: AbortSignal.timeout(120_000),
    }
  );
  if (!res.ok) throw new Error(`ElevenLabs TTS failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function openAiTts(text: string): Promise<Buffer> {
  const apiKey = process.env.OPENAI_API_KEY?.trim();
  if (!apiKey) throw new Error("OPENAI_API_KEY missing");
  const res = await fetch("https://api.openai.com/v1/audio/speech", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: process.env.OPENAI_TTS_MODEL ?? "tts-1",
      voice: process.env.OPENAI_TTS_VOICE ?? "alloy",
      input: text.slice(0, 4096),
      response_format: "mp3",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) throw new Error(`OpenAI TTS failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

async function silentAudio(durationSeconds: number): Promise<Buffer> {
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
