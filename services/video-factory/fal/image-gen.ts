import "server-only";

import { isFalConfigured } from "@/services/media/fal-config";

export interface FalImageInput {
  prompt: string;
  aspectRatio?: string;
  /** Router-selected fal model id (e.g. fal-ai/flux/schnell) */
  modelId?: string;
}

export interface FalImageResult {
  imageUrl: string;
  requestId?: string;
  seed?: number;
  model: string;
  width?: number;
  height?: number;
}

/**
 * Generate a static frame via fal image queue API.
 */
export async function generateFalImage(input: FalImageInput): Promise<FalImageResult> {
  if (!isFalConfigured()) {
    throw new Error("fal is not configured");
  }
  const falKey = process.env.FAL_KEY?.trim();
  if (!falKey) throw new Error("FAL_KEY missing");

  const model = input.modelId?.trim();
  if (!model) {
    throw new Error("fal modelId is required — use selectFalImageModel() before calling generateFalImage");
  }

  const isLandscape = input.aspectRatio === "16:9";
  const imageSize = isLandscape ? "landscape_16_9" : "portrait_16_9";

  const body: Record<string, unknown> = {
    prompt: input.prompt,
    image_size: imageSize,
    num_images: 1,
  };

  console.log(`[fal] image model=${model} size=${imageSize}`);

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
    throw new Error(`fal image submit failed: ${submit.status} ${await submit.text()}`);
  }
  const queued = (await submit.json()) as {
    request_id?: string;
    response_url?: string;
    status_url?: string;
  };
  const statusUrl = queued.status_url;
  const responseUrl = queued.response_url;
  if (!statusUrl || !responseUrl) {
    throw new Error("fal image returned no status/response URLs");
  }

  const deadline = Date.now() + 120_000;
  while (Date.now() < deadline) {
    await sleep(2_000);
    const statusRes = await fetch(statusUrl, {
      headers: { Authorization: `Key ${falKey}` },
      signal: AbortSignal.timeout(15_000),
    });
    if (!statusRes.ok) continue;
    const status = (await statusRes.json()) as { status?: string };
    if (status.status === "FAILED") {
      throw new Error("fal image generation failed");
    }
    if (status.status !== "COMPLETED") continue;

    const resultRes = await fetch(responseUrl, {
      headers: { Authorization: `Key ${falKey}` },
      signal: AbortSignal.timeout(30_000),
    });
    if (!resultRes.ok) {
      throw new Error(`fal image result fetch failed: ${resultRes.status}`);
    }
    const result = (await resultRes.json()) as {
      images?: Array<{ url?: string; width?: number; height?: number }>;
      image?: { url?: string };
      seed?: number;
    };
    const imageUrl =
      result.images?.[0]?.url ?? result.image?.url;
    if (!imageUrl) throw new Error("fal image returned no image URL");
    return {
      imageUrl,
      requestId: queued.request_id,
      seed: result.seed,
      model,
      width: result.images?.[0]?.width,
      height: result.images?.[0]?.height,
    };
  }
  throw new Error("fal image timed out");
}

export async function downloadRemoteImage(url: string): Promise<Buffer> {
  const res = await fetch(url, { signal: AbortSignal.timeout(60_000) });
  if (!res.ok) throw new Error(`image download failed: ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
