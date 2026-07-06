import "server-only";

import { getManagedProviderConfig } from "@/services/providers/config";

export interface FalProviderStatus {
  configured: boolean;
  enabled: boolean;
  message: string;
}

export function isFalConfigured(): boolean {
  return getManagedProviderConfig().fal.configured;
}

export function getFalProviderStatus(): FalProviderStatus {
  const config = getManagedProviderConfig();
  return {
    configured: config.fal.configured,
    enabled: config.fal.enabled,
    message: config.fal.configured
      ? "Fal credentials are configured. Seedance text-to-video runs for ai_broll scenes when storyboard asset_method is fal_clip."
      : "Fal is not configured. Set FAL_KEY to enable Seedance text-to-video b-roll.",
  };
}

export function assertFalConfigured(): void {
  if (!isFalConfigured()) {
    throw new Error("Fal is not configured. Set FAL_KEY on the server.");
  }
}

/** Delegate to video-factory image generation. */
export async function generateFalImagePlaceholder(prompt: string): Promise<{ imageUrl: string }> {
  const { generateFalImage } = await import("@/services/video-factory/fal/image-gen");
  const { selectFalImageModel } = await import("@/services/video-factory/fal/model-router");
  const selected = selectFalImageModel({
    falRenderMode: "cinematic",
    scenePurpose: "hook",
  });
  const result = await generateFalImage({ prompt, modelId: selected.modelId });
  return { imageUrl: result.imageUrl };
}
