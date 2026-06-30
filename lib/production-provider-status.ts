import "server-only";

import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import { getFalProviderStatus } from "@/services/media/fal-config";
import type { ProductionProviderStatus } from "@/components/growth/production-provider-bar";

export function getProductionProviderStatus(): ProductionProviderStatus {
  const ffmpeg = checkFfmpegHealth();
  const fal = getFalProviderStatus();
  const elevenConfigured = Boolean(process.env.ELEVENLABS_API_KEY?.trim());

  return {
    ffmpeg: { ok: ffmpeg.available, message: ffmpeg.message },
    fal: { ok: fal.configured, message: fal.message },
    elevenlabs: {
      ok: elevenConfigured,
      message: elevenConfigured
        ? "Voiceover TTS available"
        : "Set ELEVENLABS_API_KEY for voice modes",
    },
  };
}
