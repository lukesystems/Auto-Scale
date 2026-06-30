import type { FalRenderMode } from "../production-options";
import type { FalModelTier } from "../production-options";
import type { SceneContract } from "../scene-contract";
import {
  getDefaultFalVideoModel,
  resolveEnvModelOverride,
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

function resolveEffectiveTier(input: SelectFalVideoModelInput): FalVideoModelTier {
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
  const hasImage = Boolean(input.referenceImageUrl?.trim());
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

/** UI helper: describe the dominant tier for a run at the storyboards gate. */
export function describeFalTierForRun(input: {
  falRenderMode: FalRenderMode;
  falModelTier?: FalModelTier;
}): string {
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
