import { z } from "zod";

import type { ProductionMode } from "./production-modes";
import {
  coerceCreativeFormat,
  coerceQualityTier,
  coerceRenderStyle,
  coerceVideoOutputMode,
  DEFAULT_PRODUCTION_PRESET,
  DEFAULT_PRODUCTION_QUALITY_OPTIONS,
  deriveLegacyProductionFormat,
  legacyProductionFormatToCreative,
  maxFalScenesForTier,
  maxAiVideoScenesForTier,
  qualityTierToFalRenderMode,
  resolveVideoOutputMode,
  shouldUseAiBrollForScene,
  coerceFallbackOnBadAiScene,
  sceneRenderMethodToSlideStyle,
  type CreativeFormat,
  type QualityTier,
  type RenderStyle,
  type VideoOutputMode,
} from "./scene-render-plan";
export {
  CREATIVE_FORMATS,
  CreativeFormatSchema,
  RENDER_STYLES,
  RenderStyleSchema,
  QUALITY_TIERS,
  QualityTierSchema,
  VIDEO_OUTPUT_MODES,
  VideoOutputModeSchema,
  VIDEO_OUTPUT_MODE_SPECS,
  DEFAULT_PRODUCTION_PRESET,
  DEFAULT_PRODUCTION_QUALITY_OPTIONS,
  buildSceneRenderPlan,
  shouldUseAiBrollForScene,
  sceneRenderMethodToVisualMethod,
  sceneRenderMethodToSlideStyle,
  maxFalScenesForTier,
  maxAiVideoScenesForTier,
  resolveVideoOutputMode,
  legacyProductionFormatToCreative,
  deriveLegacyProductionFormat,
  coerceCreativeFormat,
  coerceRenderStyle,
  coerceQualityTier,
  coerceVideoOutputMode,
  coerceFallbackOnBadAiScene,
  type CreativeFormat,
  type RenderStyle,
  type QualityTier,
  type VideoOutputMode,
  type SceneRenderPlanEntry,
  type VideoOutputModeSpec,
} from "./scene-render-plan";



/** User-selectable production format (one per run or concept). */

export const PRODUCTION_FORMATS = [

  "pain_led",

  "slide",

  "ai_broll_short",

  "objection",

  "comparison",

] as const;

export type ProductionFormat = (typeof PRODUCTION_FORMATS)[number];

export const ProductionFormatSchema = z.enum(PRODUCTION_FORMATS);



/** User-selectable audio mode for rendered videos. */

export const AUDIO_MODES = ["music_only", "voiceover", "voiceover_bgm"] as const;

export type AudioMode = (typeof AUDIO_MODES)[number];

export const AudioModeSchema = z.enum(AUDIO_MODES);



/** Fal render mode: cinematic b-roll vs slide-only fast path. */

export const FAL_RENDER_MODES = ["cinematic", "fast"] as const;

export type FalRenderMode = (typeof FAL_RENDER_MODES)[number];

export const FalRenderModeSchema = z.enum(FAL_RENDER_MODES);

/** Optional override for fal model sophistication within a run. */
export const FAL_MODEL_TIERS = ["auto", "fast", "standard", "cinematic"] as const;
export type FalModelTier = (typeof FAL_MODEL_TIERS)[number];
export const FalModelTierSchema = z.enum(FAL_MODEL_TIERS);

/** Per-scene visual generation pipeline for ai_broll scenes. */
export const VISUAL_PIPELINES = ["slide", "t2v", "image_to_video"] as const;
export type VisualPipeline = (typeof VISUAL_PIPELINES)[number];
export const VisualPipelineSchema = z.enum(VISUAL_PIPELINES);

export interface VisualPipelineSpec {
  pipeline: VisualPipeline;
  label: string;
  description: string;
  requiresFal: boolean;
}

export const VISUAL_PIPELINE_SPECS: Record<VisualPipeline, VisualPipelineSpec> = {
  slide: {
    pipeline: "slide",
    label: "Static slides only",
    description: "Fastest, lowest cost — Sharp/SVG slides for every scene. No Fal calls.",
    requiresFal: false,
  },
  t2v: {
    pipeline: "t2v",
    label: "Direct text-to-video",
    description: "One Fal Seedance call per b-roll scene. Good balance of speed and motion quality.",
    requiresFal: true,
  },
  image_to_video: {
    pipeline: "image_to_video",
    label: "Image → video (I2V)",
    description:
      "Two Fal calls per scene (flux frame, then Seedance I2V). Best visual consistency for ai_broll shorts.",
    requiresFal: true,
  },
};

export function describeVisualPipeline(
  pipeline: VisualPipeline | null | undefined,
  resolved?: VisualPipeline
): string {
  if (!pipeline) {
    const auto = resolved ?? "t2v";
    return `Auto (${VISUAL_PIPELINE_SPECS[auto].label.toLowerCase()})`;
  }
  return VISUAL_PIPELINE_SPECS[pipeline].label;
}

export interface ProductionFormatSpec {

  format: ProductionFormat;

  label: string;

  description: string;

  implemented: boolean;

  requiresFal: boolean;

  requiresUpload: boolean;

  fallbackFormat: ProductionFormat | null;

  defaultAudioModes: AudioMode[];

  defaultBgmMood: "energetic" | "calm" | "tech";

}



export const PRODUCTION_FORMAT_SPECS: Record<ProductionFormat, ProductionFormatSpec> = {

  pain_led: {

    format: "pain_led",

    label: "Pain-led",

    description:

      "Bold hook slide → AI or slide middle scenes (problem, mechanism, proof) → slide CTA. Best for problem-aware audiences.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: "slide",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "tech",

  },

  slide: {

    format: "slide",

    label: "Slide deck",

    description: "100% Sharp/SVG slides with on-screen text. Fast, reliable, no AI b-roll required.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: null,

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "calm",

  },

  ai_broll_short: {

    format: "ai_broll_short",

    label: "AI video (Fal)",

    description:

      "Real AI-generated video clips (Fal image → video) + hook/CTA slides. No screen recording upload.",

    implemented: true,

    requiresFal: true,

    requiresUpload: false,

    fallbackFormat: "pain_led",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "tech",

  },

  objection: {

    format: "objection",

    label: "Objection handler",

    description: "Myth → Reality → Proof → CTA. Handles skeptic beliefs with evidence-backed rebuttals.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: "pain_led",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "calm",

  },

  comparison: {

    format: "comparison",

    label: "Comparison",

    description: "Split Them vs Us slides with proof beat and verdict CTA. Great for category positioning.",

    implemented: true,

    requiresFal: false,

    requiresUpload: false,

    fallbackFormat: "slide",

    defaultAudioModes: ["voiceover", "voiceover_bgm", "music_only"],

    defaultBgmMood: "energetic",

  },

};



/** Legacy runs may still store demo_short — always map to AI video. */
export function coerceProductionFormat(raw: string | null | undefined): ProductionFormat {
  if (raw === "demo_short") return "ai_broll_short";
  const parsed = ProductionFormatSchema.safeParse(raw);
  return parsed.success ? parsed.data : "slide";
}



export interface AudioModeSpec {

  mode: AudioMode;

  label: string;

  description: string;

  requiresElevenLabs: boolean;

}



export const AUDIO_MODE_SPECS: Record<AudioMode, AudioModeSpec> = {

  music_only: {

    mode: "music_only",

    label: "Music only",

    description: "No voiceover — background music drives pacing; on-screen text carries the message.",

    requiresElevenLabs: false,

  },

  voiceover: {

    mode: "voiceover",

    label: "Voiceover",

    description: "ElevenLabs TTS narration only — no background music.",

    requiresElevenLabs: true,

  },

  voiceover_bgm: {

    mode: "voiceover_bgm",

    label: "Voice + music",

    description: "ElevenLabs voiceover mixed with royalty-free background music (ducked under voice).",

    requiresElevenLabs: true,

  },

};



/** Map user-facing format to internal production mode. */

export function resolveProductionModeFromFormat(format: ProductionFormat): ProductionMode {

  switch (format) {

    case "slide":

    case "pain_led":

    case "objection":

    case "comparison":

      return "fast_slides";

    case "ai_broll_short":

      return "ai_broll_short";

    default:

      return "fast_slides";

  }

}



/** Whether middle scenes should prefer fal/ai_broll for this format. */
/** @deprecated Use shouldUseAiBrollForScene with renderStyle + qualityTier. */
export function preferAiBrollForFormat(
  format: ProductionFormat,
  falRenderMode: FalRenderMode = "cinematic",
  falConfigured = false
): boolean {
  const legacy = legacyProductionFormatToCreative(format);
  if (falRenderMode === "fast" || !falConfigured) return false;
  return (
    shouldUseAiBrollForScene("problem", legacy.renderStyle, legacy.qualityTier, falConfigured) ||
    shouldUseAiBrollForScene("mechanism", legacy.renderStyle, legacy.qualityTier, falConfigured)
  );
}



/** Map production format to concept video_type for strategy alignment. */

export function productionFormatToVideoType(

  format: ProductionFormat

): "slide" | "pain_led" | "ai_broll" | "objection" | "comparison" {

  switch (format) {

    case "slide":

      return "slide";

    case "pain_led":

      return "pain_led";

    case "ai_broll_short":

      return "ai_broll";

    case "objection":

      return "objection";

    case "comparison":

      return "comparison";

  }

}



export function resolveProductionOptions(input: {
  productionFormat?: ProductionFormat | null;
  videoOutputMode?: VideoOutputMode | string | null;
  creativeFormat?: CreativeFormat | string | null;
  renderStyle?: RenderStyle | string | null;
  qualityTier?: QualityTier | string | null;
  audioMode?: AudioMode | null;
  falRenderMode?: FalRenderMode | null;
  falModelTier?: FalModelTier | null;
  visualPipeline?: VisualPipeline | null;
  maxFalScenes?: number | null;
  /** When true and no explicit fal_render_mode, default to cinematic. */
  falConfigured?: boolean;
  projectDefaults?: {
    production_format?: ProductionFormat | null;
    video_output_mode?: VideoOutputMode | string | null;
    creative_format?: CreativeFormat | string | null;
    render_style?: RenderStyle | string | null;
    quality_tier?: QualityTier | string | null;
    audio_mode?: AudioMode | null;
    fal_render_mode?: FalRenderMode | null;
    fal_model_tier?: FalModelTier | null;
    visual_pipeline?: VisualPipeline | null;
    max_fal_scenes?: number | null;
  };
}): {
  productionFormat: ProductionFormat;
  videoOutputMode: VideoOutputMode;
  creativeFormat: CreativeFormat;
  renderStyle: RenderStyle;
  qualityTier: QualityTier;
  audioMode: AudioMode;
  falRenderMode: FalRenderMode;
  falModelTier: FalModelTier;
  visualPipeline: VisualPipeline;
  maxFalScenes: number;
} {
  const falConfigured = input.falConfigured ?? false;

  const videoOutputModeRaw =
    input.videoOutputMode ?? input.projectDefaults?.video_output_mode ?? null;

  let videoOutputMode = coerceVideoOutputMode(
    typeof videoOutputModeRaw === "string" ? videoOutputModeRaw : null
  );
  let creativeFormat = coerceCreativeFormat(
    input.creativeFormat ?? input.projectDefaults?.creative_format ?? null
  );
  let renderStyle = coerceRenderStyle(
    input.renderStyle ?? input.projectDefaults?.render_style ?? null
  );
  let qualityTier = coerceQualityTier(
    input.qualityTier ?? input.projectDefaults?.quality_tier ?? null
  );

  if (videoOutputModeRaw) {
    const preset = resolveVideoOutputMode(videoOutputModeRaw);
    creativeFormat = preset.creativeFormat;
    renderStyle = preset.renderStyle;
    qualityTier = preset.qualityTier;
    videoOutputMode = preset.mode;
  } else if (
    input.productionFormat ||
    input.projectDefaults?.production_format
  ) {
    const legacy = legacyProductionFormatToCreative(
      coerceProductionFormat(
        input.productionFormat ?? input.projectDefaults?.production_format ?? "pain_led"
      )
    );
    creativeFormat = legacy.creativeFormat;
    renderStyle = legacy.renderStyle;
    qualityTier = legacy.qualityTier;
    videoOutputMode = legacy.videoOutputMode;
  } else if (!input.creativeFormat && !input.renderStyle && !input.qualityTier) {
    const preset = DEFAULT_PRODUCTION_PRESET;
    creativeFormat = preset.creativeFormat;
    renderStyle = preset.renderStyle;
    qualityTier = preset.qualityTier;
    videoOutputMode = preset.mode;
  }

  const productionFormat = deriveLegacyProductionFormat({ creativeFormat, renderStyle });

  const audioMode =
    input.audioMode ?? input.projectDefaults?.audio_mode ?? "voiceover_bgm";

  const falRenderMode =
    input.falRenderMode ??
    input.projectDefaults?.fal_render_mode ??
    (falConfigured ? qualityTierToFalRenderMode(qualityTier) : "fast");

  const falModelTier =
    input.falModelTier ?? input.projectDefaults?.fal_model_tier ?? "auto";

  const maxFalScenes =
    input.maxFalScenes ??
    input.projectDefaults?.max_fal_scenes ??
    maxFalScenesForTier(qualityTier, renderStyle);

  const visualPipeline = resolveVisualPipeline({
    visualPipeline:
      input.visualPipeline ?? input.projectDefaults?.visual_pipeline ?? null,
    productionFormat,
    renderStyle,
    qualityTier,
    falRenderMode: FalRenderModeSchema.parse(falRenderMode),
    falConfigured,
  });

  return {
    productionFormat: ProductionFormatSchema.parse(productionFormat),
    videoOutputMode,
    creativeFormat,
    renderStyle,
    qualityTier,
    audioMode: AudioModeSchema.parse(audioMode),
    falRenderMode: FalRenderModeSchema.parse(falRenderMode),
    falModelTier: FalModelTierSchema.parse(falModelTier),
    visualPipeline: VisualPipelineSchema.parse(visualPipeline),
    maxFalScenes,
  };
}



/** Resolve per-scene visual pipeline with safe backward-compatible defaults. */
export function resolveVisualPipeline(input: {
  visualPipeline?: VisualPipeline | null;
  productionFormat: ProductionFormat;
  renderStyle?: RenderStyle;
  qualityTier?: QualityTier;
  falRenderMode: FalRenderMode;
  falConfigured: boolean;
}): VisualPipeline {
  if (input.visualPipeline) {
    return VisualPipelineSchema.parse(input.visualPipeline);
  }
  const renderStyle =
    input.renderStyle ?? legacyProductionFormatToCreative(input.productionFormat).renderStyle;
  const qualityTier =
    input.qualityTier ?? legacyProductionFormatToCreative(input.productionFormat).qualityTier;

  if (
    renderStyle === "slides_only" ||
    qualityTier === "draft" ||
    !input.falConfigured ||
    input.falRenderMode === "fast"
  ) {
    return "slide";
  }
  if (
    (renderStyle === "hybrid_quality" || renderStyle === "full_ai_video") &&
    input.falConfigured
  ) {
    return "image_to_video";
  }
  if (input.productionFormat === "ai_broll_short" && input.falConfigured) {
    return "image_to_video";
  }
  return "t2v";
}



export function audioModeUsesVoiceover(mode: AudioMode): boolean {

  return mode === "voiceover" || mode === "voiceover_bgm";

}



export function audioModeUsesMusic(mode: AudioMode): boolean {

  return mode === "music_only" || mode === "voiceover_bgm";

}



export function bgmMoodForFormat(format: ProductionFormat): "energetic" | "calm" | "tech" {

  return PRODUCTION_FORMAT_SPECS[format].defaultBgmMood;

}


