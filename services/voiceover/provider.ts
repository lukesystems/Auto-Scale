import "server-only";

import { runFfmpeg } from "@/services/video-factory/ffmpeg";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";

export type VoiceProviderId = "elevenlabs" | "silent_dev_fallback";

export interface VoiceoverResult {
  buffer: Buffer;
  provider: VoiceProviderId;
  isSilent: boolean;
  qualityPenalty: number;
  /** Providers tried in order; failures include error messages for UI/debug. */
  attemptLog: Array<{ provider: VoiceProviderId; ok: boolean; error?: string }>;
  alignment?: CharacterAlignment | null;
}

export interface CharacterAlignment {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}

/** Rachel — premade ElevenLabs voice available on free tier via API. */
export const ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID = "21m00Tcm4TlvDq8ikWAM";

/**
 * Premade voices usable on the free API plan. Voice Library / community voices
 * return HTTP 402 paid_plan_required for free accounts.
 * @see https://elevenlabs.io/docs/overview/capabilities/voices
 */
export const ELEVENLABS_FREE_TIER_PREMADE_VOICE_IDS = [
  "21m00Tcm4TlvDq8ikWAM", // Rachel — calm female
  "pNInz6obpgDQGcFmaJgB", // Adam — deep male
  "EXAVITQu4vr4xnSDxMaL", // Sarah — soft female
  "29vD33N1CtxCmqQRPOHJ", // Drew — well-rounded male
  "AZnzlk1XvdvUeBnXmlld", // Domi — assertive female
  "ErXwobaYiN019PkySvjV", // Antoni — well-rounded male
  "CYw3kZ02Hs0563khs1Fj", // Dave — British male
  "D38z5RcWu1voky8WS1ja", // Fin — Irish male
  "2EiwWnXFnvU5JabPnv8n", // Clyde — character male
  "5Q0t7uMcjvnagumLfvZi", // Paul — reporter male
] as const;

/** Configured ElevenLabs voice (ELEVENLABS_VOICE_ID → DEFAULT_VOICE_ID → Rachel). */
export function getConfiguredElevenLabsVoiceId(): string {
  return (
    process.env.ELEVENLABS_VOICE_ID?.trim() ||
    process.env.DEFAULT_VOICE_ID?.trim() ||
    ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID
  );
}

/** Fallback when configured voice is missing from the ElevenLabs account. */
export function getFallbackElevenLabsVoiceId(): string {
  return (
    process.env.ELEVENLABS_FALLBACK_VOICE_ID?.trim() ||
    ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID
  );
}

/** Non-secret voice id hint for UI (configured ElevenLabs voice). */
export function getDefaultVoiceIdHint(): string {
  return getConfiguredElevenLabsVoiceId();
}

export function isElevenLabsVoiceNotFound(status: number, body: string): boolean {
  if (status !== 404) return false;
  if (body.includes("voice_not_found")) return true;
  try {
    const parsed = JSON.parse(body) as { detail?: { status?: string } };
    return parsed.detail?.status === "voice_not_found";
  } catch {
    return false;
  }
}

/** True when a voice requires a paid plan (Voice Library on free tier). */
export function isElevenLabsPaidPlanRequired(status: number, body: string): boolean {
  if (status !== 402) return false;
  if (body.includes("paid_plan_required") || body.includes("payment_required")) return true;
  try {
    const parsed = JSON.parse(body) as { detail?: { code?: string; type?: string } };
    return (
      parsed.detail?.code === "paid_plan_required" ||
      parsed.detail?.type === "payment_required"
    );
  } catch {
    return false;
  }
}

function isElevenLabsVoiceRetryableError(message: string): boolean {
  return (
    message.includes("voice_not_found") ||
    message.includes("voice ID not found") ||
    message.includes("paid_plan_required") ||
    message.includes("payment_required")
  );
}

/** Ordered voice IDs to try: configured → fallback → free-tier premade list. */
export function buildElevenLabsVoiceRetryQueue(): string[] {
  const configured = getConfiguredElevenLabsVoiceId();
  const fallback = getFallbackElevenLabsVoiceId();
  const queue: string[] = [];
  const seen = new Set<string>();
  const add = (id: string) => {
    const trimmed = id.trim();
    if (!trimmed || seen.has(trimmed)) return;
    seen.add(trimmed);
    queue.push(trimmed);
  };
  add(configured);
  if (fallback !== configured) add(fallback);
  for (const id of ELEVENLABS_FREE_TIER_PREMADE_VOICE_IDS) add(id);
  return queue;
}

/** True when at least one real TTS provider is configured. */
export function isVoiceoverTtsConfigured(): boolean {
  return Boolean(process.env.ELEVENLABS_API_KEY?.trim());
}

function configuredProvider(): VoiceProviderId {
  const env = (process.env.VOICE_PROVIDER ?? "elevenlabs").trim().toLowerCase();
  if (env === "silent") return "silent_dev_fallback";
  return "elevenlabs";
}

export async function synthesizeWithProvider(opts: {
  scriptText: string;
  durationSeconds: number;
  /** When false (default), missing TTS keys throw instead of silent audio. */
  allowSilentFallback?: boolean;
}): Promise<VoiceoverResult> {
  const text = opts.scriptText.trim();
  const allowSilent = opts.allowSilentFallback ?? false;
  const order: VoiceProviderId[] = [];
  const primary = configuredProvider();
  order.push(primary);
  if (primary !== "elevenlabs" && process.env.ELEVENLABS_API_KEY) order.push("elevenlabs");
  if (allowSilent) order.push("silent_dev_fallback");

  const tried = new Set<VoiceProviderId>();
  const attemptLog: VoiceoverResult["attemptLog"] = [];
  for (const provider of order) {
    if (tried.has(provider)) continue;
    tried.add(provider);
    try {
      if (provider === "elevenlabs" && process.env.ELEVENLABS_API_KEY && text) {
        const withTimestamps = await elevenLabsTtsWithTimestamps(text);
        attemptLog.push({ provider, ok: true });
        return {
          buffer: withTimestamps.buffer,
          provider,
          isSilent: false,
          qualityPenalty: 0,
          attemptLog,
          alignment: withTimestamps.alignment,
        };
      }
      if (provider === "silent_dev_fallback") {
        const buffer = await silentAudio(opts.durationSeconds);
        attemptLog.push({ provider, ok: true });
        return { buffer, provider, isSilent: true, qualityPenalty: 0.25, attemptLog };
      }
      if (provider === "elevenlabs" && !process.env.ELEVENLABS_API_KEY) {
        attemptLog.push({ provider, ok: false, error: "ELEVENLABS_API_KEY missing" });
      } else if (!text) {
        attemptLog.push({ provider, ok: false, error: "Empty script text" });
      }
    } catch (err) {
      const error = err instanceof Error ? err.message : String(err);
      attemptLog.push({ provider, ok: false, error });
      console.warn("[voiceover] provider failed, trying next", { provider, error });
    }
  }

  const summary = formatVoiceoverFailureSummary(attemptLog);
  if (allowSilent) {
    const buffer = await silentAudio(opts.durationSeconds);
    attemptLog.push({ provider: "silent_dev_fallback", ok: true });
    return {
      buffer,
      provider: "silent_dev_fallback",
      isSilent: true,
      qualityPenalty: 0.25,
      attemptLog,
    };
  }

  throw new Error(buildVoiceoverUnavailableMessage(attemptLog, summary));
}

function buildVoiceoverUnavailableMessage(
  attemptLog: VoiceoverResult["attemptLog"],
  summary: string
): string {
  const hasElevenLabsKey = Boolean(process.env.ELEVENLABS_API_KEY?.trim());
  const failed = attemptLog.filter((entry) => !entry.ok);
  const voiceIdErrors = failed.some(
    (entry) =>
      entry.error?.includes("voice_not_found") ||
      entry.error?.includes("voice ID not found")
  );
  const paidPlanErrors = failed.some(
    (entry) =>
      entry.error?.includes("paid_plan_required") ||
      entry.error?.includes("payment_required")
  );

  if (paidPlanErrors && hasElevenLabsKey) {
    const configured = getConfiguredElevenLabsVoiceId();
    return (
      `ElevenLabs voice requires a paid plan on free accounts (${configured}). ` +
      `Use a premade voice ID such as Rachel (${ELEVENLABS_BUILTIN_DEFAULT_VOICE_ID}), ` +
      `or upgrade your ElevenLabs subscription. ${summary}`
    );
  }
  if (voiceIdErrors && hasElevenLabsKey) {
    const configured = getConfiguredElevenLabsVoiceId();
    return (
      `ElevenLabs voice ID not found in your account (${configured}). ` +
      `Update ELEVENLABS_VOICE_ID or DEFAULT_VOICE_ID, or remove it to use the default Rachel voice. ${summary}`
    );
  }
  if (hasElevenLabsKey) {
    return `Voiceover synthesis failed. ${summary}`;
  }
  return `Voiceover unavailable — configure ELEVENLABS_API_KEY. ${summary}`;
}

function formatVoiceoverFailureSummary(
  attemptLog: VoiceoverResult["attemptLog"]
): string {
  const failed = attemptLog.filter((entry) => !entry.ok);
  if (!failed.length) return "No TTS providers configured.";
  return failed.map((entry) => `${entry.provider}: ${entry.error ?? "failed"}`).join("; ");
}

async function elevenLabsTtsWithTimestamps(text: string): Promise<{
  buffer: Buffer;
  alignment: CharacterAlignment | null;
}> {
  const result = await elevenLabsTtsRequest(text, { withTimestamps: true });
  return { buffer: result.buffer, alignment: result.alignment };
}

async function elevenLabsTts(text: string): Promise<Buffer> {
  const result = await elevenLabsTtsRequest(text, { withTimestamps: false });
  return result.buffer;
}

async function elevenLabsTtsRequest(
  text: string,
  opts: { withTimestamps: boolean }
): Promise<{ buffer: Buffer; alignment: CharacterAlignment | null }> {
  const apiKey = process.env.ELEVENLABS_API_KEY?.trim();
  if (!apiKey) throw new Error("ELEVENLABS_API_KEY missing");

  const voiceQueue = buildElevenLabsVoiceRetryQueue();
  let lastError: Error | null = null;

  for (let i = 0; i < voiceQueue.length; i++) {
    const voiceId = voiceQueue[i]!;
    try {
      return await callElevenLabsTts(apiKey, voiceId, text, opts);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      if (!isElevenLabsVoiceRetryableError(message) || i === voiceQueue.length - 1) {
        throw err;
      }
      lastError = err instanceof Error ? err : new Error(message);
      const reason = message.includes("paid_plan_required") || message.includes("payment_required")
        ? "paid_plan_required"
        : "voice_not_found";
      console.warn("[voiceover] ElevenLabs voice unavailable — retrying with next premade voice", {
        failedVoice: voiceId,
        nextVoice: voiceQueue[i + 1],
        reason,
      });
    }
  }

  throw lastError ?? new Error("ElevenLabs TTS failed");
}

async function callElevenLabsTts(
  apiKey: string,
  voiceId: string,
  text: string,
  opts: { withTimestamps: boolean }
): Promise<{ buffer: Buffer; alignment: CharacterAlignment | null }> {
  const endpoint = opts.withTimestamps
    ? `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}/with-timestamps`
    : `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;
  const res = await fetch(endpoint, {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
      Accept: opts.withTimestamps ? "application/json" : "audio/mpeg",
    },
    body: JSON.stringify({
      text: text.slice(0, 5000),
      model_id: process.env.ELEVENLABS_MODEL_ID ?? "eleven_multilingual_v2",
      voice_settings: {
        stability: 0.65,
        similarity_boost: 0.75,
        style: 0.1,
        use_speaker_boost: true,
      },
      output_format: "mp3_44100_128",
    }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!res.ok) {
    const body = await res.text().catch(() => "");
    if (isElevenLabsVoiceNotFound(res.status, body)) {
      throw new Error(
        `ElevenLabs voice ID not found (${voiceId}) — voice_not_found`
      );
    }
    if (isElevenLabsPaidPlanRequired(res.status, body)) {
      throw new Error(
        `ElevenLabs voice requires paid plan (${voiceId}) — paid_plan_required`
      );
    }
    throw new Error(
      `ElevenLabs TTS failed: HTTP ${res.status}${body ? ` — ${body.slice(0, 200)}` : ""}`
    );
  }

  if (opts.withTimestamps) {
    const json = (await res.json()) as {
      audio_base64?: string;
      alignment?: CharacterAlignment;
      normalized_alignment?: CharacterAlignment;
    };
    if (!json.audio_base64) {
      throw new Error("ElevenLabs with-timestamps returned no audio");
    }
    return {
      buffer: Buffer.from(json.audio_base64, "base64"),
      alignment: json.alignment ?? json.normalized_alignment ?? null,
    };
  }

  return { buffer: Buffer.from(await res.arrayBuffer()), alignment: null };
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
