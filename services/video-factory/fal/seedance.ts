import "server-only";

import { isFalConfigured } from "@/services/media/fal-config";

export interface SeedanceClipInput {
  prompt: string;
  durationSeconds?: number;
  aspectRatio?: string;
}

export interface SeedanceClipResult {
  videoUrl: string;
  requestId?: string;
}

const DEFAULT_MODEL =
  process.env.AUTOSCALE_FAL_SEEDANCE_MODEL?.trim() ||
  "fal-ai/bytedance/seedance/v1/lite/text-to-video";

/**
 * Generate a short AI clip via fal Seedance. Only used when
 * storyboard.scene.asset_method === 'fal_clip' and FAL_KEY is set.
 */
export async function generateSeedanceClip(
  input: SeedanceClipInput
): Promise<SeedanceClipResult> {
  if (!isFalConfigured()) {
    throw new Error("fal is not configured");
  }
  const falKey = process.env.FAL_KEY?.trim();
  if (!falKey) throw new Error("FAL_KEY missing");

  const aspect = input.aspectRatio === "16:9" ? "16:9" : "9:16";
  const duration = Math.min(10, Math.max(3, Math.round(input.durationSeconds ?? 5)));

  const submit = await fetch(`https://queue.fal.run/${DEFAULT_MODEL}`, {
    method: "POST",
    headers: {
      Authorization: `Key ${falKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: input.prompt,
      aspect_ratio: aspect,
      duration,
    }),
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
  while (Date.now() < deadline) {
    await sleep(3_000);
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!statusRes.ok) continue;
    const status = (await statusRes.json()) as { status?: string };
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
    };
    const videoUrl = result.video?.url ?? result.video_url;
    if (!videoUrl) throw new Error("fal Seedance returned no video URL");
    return { videoUrl, requestId: queued.request_id };
  }
  throw new Error("fal Seedance timed out");
}

export async function downloadRemoteVideo(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`video download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
