export type FalVideoModelTier = "fast" | "standard" | "cinematic";
export type FalVideoModelMode = "text_to_video" | "image_to_video";

export interface FalVideoModelSpec {
  id: string;
  tier: FalVideoModelTier;
  mode: FalVideoModelMode;
  label: string;
  description: string;
  maxDuration: number;
  supportedResolutions: string[];
  supportsAudio: boolean;
  deprecated?: boolean;
}

/** Curated fal video models — never default to deprecated entries. */
export const FAL_VIDEO_MODEL_CATALOG: FalVideoModelSpec[] = [
  {
    id: "bytedance/seedance-2.0/fast/text-to-video",
    tier: "fast",
    mode: "text_to_video",
    label: "Seedance 2.0 Fast",
    description: "Budget T2V — lower latency and cost for slide-adjacent b-roll.",
    maxDuration: 15,
    supportedResolutions: ["480p", "720p"],
    supportsAudio: true,
  },
  {
    id: "fal-ai/bytedance/seedance/v1.5/pro/text-to-video",
    tier: "standard",
    mode: "text_to_video",
    label: "Seedance 1.5 Pro",
    description: "Balanced T2V with native audio — proof and CTA scenes.",
    maxDuration: 12,
    supportedResolutions: ["480p", "720p"],
    supportsAudio: true,
  },
  {
    id: "bytedance/seedance-2.0/text-to-video",
    tier: "cinematic",
    mode: "text_to_video",
    label: "Seedance 2.0",
    description: "Cinematic T2V with director-level motion and native audio.",
    maxDuration: 15,
    supportedResolutions: ["480p", "720p"],
    supportsAudio: true,
  },
  {
    id: "bytedance/seedance-2.0/fast/image-to-video",
    tier: "fast",
    mode: "image_to_video",
    label: "Seedance 2.0 Fast I2V",
    description: "Animate a reference frame on a budget.",
    maxDuration: 15,
    supportedResolutions: ["480p", "720p"],
    supportsAudio: true,
  },
  {
    id: "fal-ai/bytedance/seedance/v1.5/pro/image-to-video",
    tier: "standard",
    mode: "image_to_video",
    label: "Seedance 1.5 Pro I2V",
    description: "Animate product screenshots and slides with synchronized audio.",
    maxDuration: 12,
    supportedResolutions: ["480p", "720p"],
    supportsAudio: true,
  },
  {
    id: "bytedance/seedance-2.0/image-to-video",
    tier: "cinematic",
    mode: "image_to_video",
    label: "Seedance 2.0 I2V",
    description: "Cinematic image-to-video for hook frames and product shots.",
    maxDuration: 15,
    supportedResolutions: ["480p", "720p"],
    supportsAudio: true,
  },
  {
    id: "fal-ai/bytedance/seedance/v1/lite/text-to-video",
    tier: "fast",
    mode: "text_to_video",
    label: "Seedance v1 Lite (deprecated)",
    description: "Legacy lite model — do not use as default.",
    maxDuration: 10,
    supportedResolutions: ["480p", "720p"],
    supportsAudio: false,
    deprecated: true,
  },
];

const CATALOG_BY_ID = new Map(FAL_VIDEO_MODEL_CATALOG.map((m) => [m.id, m]));

export function getFalVideoModelById(id: string): FalVideoModelSpec | undefined {
  return CATALOG_BY_ID.get(id);
}

export function getFalModelsForTierAndMode(
  tier: FalVideoModelTier,
  mode: FalVideoModelMode
): FalVideoModelSpec[] {
  return FAL_VIDEO_MODEL_CATALOG.filter(
    (m) => m.tier === tier && m.mode === mode && !m.deprecated
  );
}

export function getDefaultFalVideoModel(
  tier: FalVideoModelTier,
  mode: FalVideoModelMode
): FalVideoModelSpec {
  const matches = getFalModelsForTierAndMode(tier, mode);
  if (!matches.length) {
    throw new Error(`No fal video model for tier=${tier} mode=${mode}`);
  }
  return matches[0]!;
}

/** Map env overrides to catalog entries; warn on deprecated ids. */
export function resolveEnvModelOverride(
  envValue: string | undefined,
  fallbackTier: FalVideoModelTier,
  mode: FalVideoModelMode
): FalVideoModelSpec {
  const trimmed = envValue?.trim();
  if (trimmed) {
    const known = getFalVideoModelById(trimmed);
    if (known) return known;
    return {
      id: trimmed,
      tier: fallbackTier,
      mode,
      label: trimmed,
      description: "Custom model from environment override.",
      maxDuration: 15,
      supportedResolutions: ["480p", "720p"],
      supportsAudio: true,
    };
  }
  return getDefaultFalVideoModel(fallbackTier, mode);
}

export function getEnvDefaultT2vModel(): FalVideoModelSpec {
  return resolveEnvModelOverride(
    typeof process !== "undefined" ? process.env.AUTOSCALE_FAL_SEEDANCE_MODEL : undefined,
    "cinematic",
    "text_to_video"
  );
}

export function getEnvDefaultI2vModel(): FalVideoModelSpec {
  return resolveEnvModelOverride(
    typeof process !== "undefined" ? process.env.AUTOSCALE_FAL_SEEDANCE_I2V_MODEL : undefined,
    "cinematic",
    "image_to_video"
  );
}

export const FAL_VIDEO_TIER_LABELS: Record<FalVideoModelTier, string> = {
  fast: "Fast (Seedance 2.0 Fast)",
  standard: "Standard (Seedance 1.5 Pro)",
  cinematic: "Cinematic (Seedance 2.0)",
};
