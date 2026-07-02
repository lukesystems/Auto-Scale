import type { FalRenderMode } from "../production-options";
import type { FalModelTier } from "../production-options";
import type { ProductionFormat } from "../production-options";
import type { QualityTier, RenderStyle, VideoOutputMode } from "../scene-render-plan";
import { PRODUCTION_FORMAT_SPECS } from "../production-options";
import type { SceneContract } from "../scene-contract";
import {
  getDefaultFalImageModel,
  getDefaultFalVideoModel,
  getEnvDefaultFastImageModel,
  getEnvDefaultImageModel,
  resolveEnvImageModelOverride,
  resolveEnvModelOverride,
  type FalImageModelSpec,
  type FalImageModelTier,
  type FalVideoModelMode,
  type FalVideoModelSpec,
  type FalVideoModelTier,
} from "./model-catalog";

export interface SelectFalVideoModelInput {
  falRenderMode: FalRenderMode;
  /** User override; `auto` derives tier from render mode + scene purpose. */
  falModelTier?: FalModelTier;
  scenePurpose: SceneContract["purpose"];
  referenceImageUrl?: string | null;
  /** When set (e.g. from fal_image asset), forces I2V mode. */
  falImageAssetUrl?: string | null;
  durationSeconds: number;
  aspectRatio?: string;
}

export interface SelectedFalVideoModel {
  modelId: string;
  mode: FalVideoModelMode;
  resolution: string;
  duration: number;
  tier: FalVideoModelTier;
  label: string;
}

function resolveEffectiveTier(input: {
  falRenderMode: FalRenderMode;
  falModelTier?: FalModelTier;
  scenePurpose: SceneContract["purpose"];
}): FalVideoModelTier {
  const explicit = input.falModelTier ?? "auto";
  if (explicit !== "auto") return explicit;

  if (input.falRenderMode === "fast") return "fast";

  const purpose = input.scenePurpose;
  if (purpose === "hook" || purpose === "problem" || purpose === "mechanism") {
    return "cinematic";
  }
  if (purpose === "proof" || purpose === "cta") {
    return "standard";
  }
  return "standard";
}

function pickModelSpec(
  tier: FalVideoModelTier,
  mode: FalVideoModelMode
): FalVideoModelSpec {
  const envRaw =
    mode === "image_to_video"
      ? process.env.AUTOSCALE_FAL_SEEDANCE_I2V_MODEL?.trim()
      : process.env.AUTOSCALE_FAL_SEEDANCE_MODEL?.trim();

  if (envRaw && tier === "cinematic") {
    return resolveEnvModelOverride(envRaw, tier, mode);
  }

  return getDefaultFalVideoModel(tier, mode);
}

function clampDuration(spec: FalVideoModelSpec, durationSeconds: number): number {
  return Math.min(spec.maxDuration, Math.max(4, Math.round(durationSeconds)));
}

function resolutionForTier(tier: FalVideoModelTier): string {
  return tier === "fast" ? "480p" : "720p";
}

/**
 * Choose fal video model based on run options, scene purpose, and reference image.
 */
export function selectFalVideoModel(input: SelectFalVideoModelInput): SelectedFalVideoModel {
  const tier = resolveEffectiveTier(input);
  const hasImage =
    Boolean(input.falImageAssetUrl?.trim()) || Boolean(input.referenceImageUrl?.trim());
  const mode: FalVideoModelMode = hasImage ? "image_to_video" : "text_to_video";
  const spec = pickModelSpec(tier, mode);
  const duration = clampDuration(spec, input.durationSeconds);

  return {
    modelId: spec.id,
    mode,
    resolution: resolutionForTier(tier),
    duration,
    tier,
    label: spec.label,
  };
}

export interface SelectFalImageModelInput {
  falRenderMode: FalRenderMode;
  falModelTier?: FalModelTier;
  scenePurpose: SceneContract["purpose"];
}

export interface SelectedFalImageModel {
  modelId: string;
  tier: FalImageModelTier;
  label: string;
}

function pickImageModelSpec(tier: FalImageModelTier): FalImageModelSpec {
  if (tier === "fast") {
    return getEnvDefaultFastImageModel();
  }
  if (tier === "cinematic") {
    return getEnvDefaultImageModel();
  }
  const envRaw = process.env.AUTOSCALE_FAL_IMAGE_MODEL?.trim();
  if (envRaw) {
    return resolveEnvImageModelOverride(envRaw, tier);
  }
  return getDefaultFalImageModel(tier);
}

/**
 * Choose fal image model for static frame generation (I2V pipeline step 1).
 */
export function selectFalImageModel(input: SelectFalImageModelInput): SelectedFalImageModel {
  const tier = resolveEffectiveTier(input);
  const spec = pickImageModelSpec(tier);
  return {
    modelId: spec.id,
    tier,
    label: spec.label,
  };
}

/** UI helper: describe dominant tier for a run at the storyboards gate. */
export function describeFalTierForRun(input: {
  falRenderMode: FalRenderMode;
  falModelTier?: FalModelTier;
  productionFormat?: ProductionFormat;
  renderStyle?: RenderStyle;
  qualityTier?: QualityTier;
  videoOutputMode?: VideoOutputMode;
}): string {
  if (
    input.videoOutputMode === "kinetic_text_ad" ||
    input.videoOutputMode === "proof_case_study"
  ) {
    return "Slides only (no Fal b-roll)";
  }
  if (input.renderStyle === "slides_only" || input.qualityTier === "draft") {
    return "Slides only (no Fal b-roll)";
  }
  if (input.productionFormat && !PRODUCTION_FORMAT_SPECS[input.productionFormat].requiresFal) {
    if (input.renderStyle !== "hybrid_quality" && input.renderStyle !== "full_ai_video") {
      return "Slides only (no Fal b-roll)";
    }
  }
  if (input.falRenderMode === "fast" && (input.falModelTier ?? "auto") === "auto") {
    return "Fast — slides only (no fal b-roll)";
  }
  const tier = input.falModelTier && input.falModelTier !== "auto"
    ? input.falModelTier
    : input.falRenderMode === "fast"
      ? "fast"
      : "cinematic";
  const labels: Record<FalVideoModelTier, string> = {
    fast: "Fast (Seedance 2.0 Fast)",
    standard: "Standard (Seedance 1.5 Pro)",
    cinematic: "Cinematic (Seedance 2.0)",
  };
  return `Video AI: ${labels[tier]}`;
}
