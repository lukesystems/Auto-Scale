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
      ? "Fal credentials are configured. Media generation pipeline is not active yet."
      : "Fal is not configured. Set FAL_KEY when media generation ships.",
  };
}

export function assertFalConfigured(): void {
  if (!isFalConfigured()) {
    throw new Error("Fal is not configured. Set FAL_KEY on the server.");
  }
}

/** Placeholder for future image generation — not implemented in V1.1. */
export async function generateFalImagePlaceholder(_prompt: string): Promise<never> {
  throw new Error("Fal image generation is not implemented yet. See docs/MEDIA_PROVIDER_PLAN.md.");
}

/** Placeholder for future video generation — not implemented in V1.1. */
export async function generateFalVideoPlaceholder(_prompt: string): Promise<never> {
  throw new Error("Fal video generation is not implemented yet. See docs/MEDIA_PROVIDER_PLAN.md.");
}
