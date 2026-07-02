import "server-only";

import { isFalConfigured } from "@/services/media/fal-config";

export interface SeedanceClipInput {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
  /** When true, fal generates its own audio — disable when muxing ElevenLabs VO */
  generateAudio?: boolean;
  imageUrl?: string;
  /** Router-selected fal model id (e.g. bytedance/seedance-2.0/text-to-video) */
  modelId?: string;
  resolution?: string;
}

export interface SeedanceClipResult {
  videoUrl: string;
  requestId?: string;
  seed?: number;
  model: string;
  mode: "text_to_video" | "image_to_video";
  resolution: string;
}

/**
 * Generate a short AI clip via fal Seedance queue API.
 */
export async function generateSeedanceClip(
  input: SeedanceClipInput
): Promise<SeedanceClipResult> {
  if (!isFalConfigured()) {
    throw new Error("fal is not configured");
  }
  const falKey = process.env.FAL_KEY?.trim();
  if (!falKey) throw new Error("FAL_KEY missing");

  const mode = input.imageUrl ? "image_to_video" : "text_to_video";
  const model = input.modelId?.trim();
  if (!model) {
    throw new Error("fal modelId is required — use selectFalVideoModel() before calling generateSeedanceClip");
  }

  const aspect = input.aspectRatio === "16:9" ? "16:9" : "9:16";
  const durationSec = Math.min(15, Math.max(4, Math.round(input.durationSeconds ?? 5)));
  const duration = String(durationSec);
  const resolution = input.resolution === "480p" ? "480p" : "720p";

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    aspect_ratio: aspect,
    duration,
    resolution,
    generate_audio: input.generateAudio ?? false,
  };
  if (input.imageUrl) {
    body.image_url = input.imageUrl;
  }

  console.log(
    `[fal] seedance ${mode} model=${model} resolution=${resolution} duration=${duration}s aspect=${aspect}`
  );

  const submit = await fetch(`https://queue.fal.run/${model}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(30_000),
  });
  if (!submit.ok) {
    throw new Error(`fal Seedance submit failed: ${submit.status} ${await submit.text()}`);
  }
  const queued = (await submit.json()) as {
    request_id?: string;
    response_url?: string;
    status_url?: string;
  };
  const statusUrl = queued.status_url;
  const responseUrl = queued.response_url;
  if (!statusUrl || !responseUrl) {
    throw new Error("fal Seedance returned no status/response URLs");
  }

  const deadline = Date.now() + 180_000;
  let lastStatus = "unknown";
  let pollCount = 0;
  while (Date.now() < deadline) {
    await sleep(3_000);
    pollCount++;
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!statusRes.ok) continue;
    const status = (await statusRes.json()) as { status?: string };
    lastStatus = status.status ?? "unknown";
    // #region agent log
    if (pollCount === 1 || pollCount % 10 === 0 || lastStatus === "FAILED" || lastStatus === "COMPLETED") {
      fetch("http://127.0.0.1:7755/ingest/e9fc8964-ae23-4fa9-a7cb-b5541b636a4d", {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6d5496" },
        body: JSON.stringify({
          sessionId: "6d5496",
          hypothesisId: "H1",
          location: "seedance.ts:poll",
          message: "fal seedance poll",
          data: { model, mode, lastStatus, pollCount, requestId: queued.request_id },
          timestamp: Date.now(),
        }),
      }).catch(() => {});
    }
    // #endregion
    if (status.status === "FAILED") {
      throw new Error("fal Seedance generation failed");
    }
    if (status.status !== "COMPLETED") continue;

    const resultRes = await fetch(responseUrl, {
      headers: { Authorization: `Key ${falKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resultRes.ok) {
      throw new Error(`fal Seedance result fetch failed: ${resultRes.status}`);
    }
    const result = (await resultRes.json()) as {
      video?: { url?: string };
      video_url?: string;
      seed?: number;
    };
    const videoUrl = result.video?.url ?? result.video_url;
    if (!videoUrl) throw new Error("fal Seedance returned no video URL");
    return {
      videoUrl,
      requestId: queued.request_id,
      seed: result.seed,
      model,
      mode,
      resolution,
    };
  }
  // #region agent log
  fetch("http://127.0.0.1:7755/ingest/e9fc8964-ae23-4fa9-a7cb-b5541b636a4d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "6d5496" },
    body: JSON.stringify({
      sessionId: "6d5496",
      hypothesisId: "H1",
      location: "seedance.ts:timeout",
      message: "fal seedance timed out",
      data: { model, mode, lastStatus, pollCount, requestId: queued.request_id },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion
  throw new Error(`fal Seedance timed out (last status: ${lastStatus}, polls: ${pollCount})`);
}

export async function downloadRemoteVideo(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`video download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
