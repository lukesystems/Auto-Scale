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

export type FalImageModelTier = "fast" | "standard" | "cinematic";

export interface FalImageModelSpec {
  id: string;
  tier: FalImageModelTier;
  label: string;
  description: string;
  deprecated?: boolean;
}

/** Curated fal image models for I2V frame generation. */
export const FAL_IMAGE_MODEL_CATALOG: FalImageModelSpec[] = [
  {
    id: "fal-ai/flux/schnell",
    tier: "fast",
    label: "Flux Schnell",
    description: "Fast frame generation for budget I2V pipeline.",
  },
  {
    id: "fal-ai/flux/dev",
    tier: "standard",
    label: "Flux Dev",
    description: "Balanced quality for proof and CTA frames.",
  },
  {
    id: "fal-ai/flux-pro/v1.1",
    tier: "standard",
    label: "Flux Pro v1.1",
    description: "Higher fidelity standard tier frames.",
  },
  {
    id: "fal-ai/flux-pro/v1.1-ultra",
    tier: "cinematic",
    label: "Flux Pro Ultra",
    description: "Cinematic hook and mechanism frames for I2V.",
  },
];

const IMAGE_CATALOG_BY_ID = new Map(FAL_IMAGE_MODEL_CATALOG.map((m) => [m.id, m]));

export function getFalImageModelById(id: string): FalImageModelSpec | undefined {
  return IMAGE_CATALOG_BY_ID.get(id);
}

export function getFalImageModelsForTier(tier: FalImageModelTier): FalImageModelSpec[] {
  return FAL_IMAGE_MODEL_CATALOG.filter((m) => m.tier === tier && !m.deprecated);
}

export function getDefaultFalImageModel(tier: FalImageModelTier): FalImageModelSpec {
  const matches = getFalImageModelsForTier(tier);
  if (!matches.length) {
    throw new Error(`No fal image model for tier=${tier}`);
  }
  return matches[0]!;
}

export function resolveEnvImageModelOverride(
  envValue: string | undefined,
  fallbackTier: FalImageModelTier
): FalImageModelSpec {
  const trimmed = envValue?.trim();
  if (trimmed) {
    const known = getFalImageModelById(trimmed);
    if (known) return known;
    return {
      id: trimmed,
      tier: fallbackTier,
      label: trimmed,
      description: "Custom image model from environment override.",
    };
  }
  return getDefaultFalImageModel(fallbackTier);
}

export function getEnvDefaultImageModel(): FalImageModelSpec {
  return resolveEnvImageModelOverride(
    typeof process !== "undefined" ? process.env.AUTOSCALE_FAL_IMAGE_MODEL : undefined,
    "cinematic"
  );
}

export function getEnvDefaultFastImageModel(): FalImageModelSpec {
  return resolveEnvImageModelOverride(
    typeof process !== "undefined" ? process.env.AUTOSCALE_FAL_IMAGE_FAST_MODEL : undefined,
    "fast"
  );
}

export const FAL_IMAGE_TIER_LABELS: Record<FalImageModelTier, string> = {
  fast: "Fast (Flux Schnell)",
  standard: "Standard (Flux Dev / Pro)",
  cinematic: "Cinematic (Flux Pro Ultra)",
};
