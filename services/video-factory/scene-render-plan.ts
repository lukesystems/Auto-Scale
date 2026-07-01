import { z } from "zod";



import type { SceneContract } from "./scene-contract";

import type { ProductionFormat } from "./production-options";

import type { FalRenderMode, VisualPipeline } from "./production-options";



/** Story / narrative structure for a video concept. */

export const CREATIVE_FORMATS = [

  "pain_led",

  "objection_handler",

  "comparison",

  "demo_walkthrough",

  "founder_story",

  "proof_case_study",

  "feature_launch",

] as const;

export type CreativeFormat = (typeof CREATIVE_FORMATS)[number];

export const CreativeFormatSchema = z.enum(CREATIVE_FORMATS);



/** How the video is rendered end-to-end. */

export const RENDER_STYLES = [

  "slides_only",

  "hybrid_quality",

  "full_ai_video",

  "product_demo",

  "ugc_style",

] as const;

export type RenderStyle = (typeof RENDER_STYLES)[number];

export const RenderStyleSchema = z.enum(RENDER_STYLES);



/** Production quality tier — cinematic is the premium default. */

export const QUALITY_TIERS = ["draft", "standard", "cinematic"] as const;

export type QualityTier = (typeof QUALITY_TIERS)[number];

export const QualityTierSchema = z.enum(QUALITY_TIERS);



/** User-facing output mode at the storyboards gate (quality-first presets). */

export const VIDEO_OUTPUT_MODES = [

  "hybrid_cinematic",

  "full_ai_cinematic",

  "product_demo_motion",

  "kinetic_text_ad",

  "ugc_founder_ad",

  "proof_case_study",

] as const;

export type VideoOutputMode = (typeof VIDEO_OUTPUT_MODES)[number];

export const VideoOutputModeSchema = z.enum(VIDEO_OUTPUT_MODES);



/** Legacy output mode names from cost/speed framing — coerced on read. */

export const LEGACY_VIDEO_OUTPUT_MODES = [

  "fast_draft",

  "hybrid_quality",

  "full_ai_video",

  "product_demo",

  "text_ad",

] as const;

export type LegacyVideoOutputMode = (typeof LEGACY_VIDEO_OUTPUT_MODES)[number];



export const SCENE_RENDER_METHODS = [

  "slide",

  "kinetic_slide",

  "metric_slide",

  "motion_slide",

  "screenshot",

  "ai_broll",

  "product_demo",

] as const;

export type SceneRenderMethod = (typeof SCENE_RENDER_METHODS)[number];



export const FALLBACK_ON_BAD_AI_SCENE_OPTIONS = [

  "replace_with_motion_slide",

  "replace_with_slide",

  "fail_render",

] as const;

export type FallbackOnBadAiScene = (typeof FALLBACK_ON_BAD_AI_SCENE_OPTIONS)[number];

export const FallbackOnBadAiSceneSchema = z.enum(FALLBACK_ON_BAD_AI_SCENE_OPTIONS);



export interface SceneRenderPlanEntry {

  purpose: SceneContract["purpose"];

  method: SceneRenderMethod;

  reason: string;

  qualityRisk: "low" | "medium" | "high";

}



export interface VideoOutputModeSpec {

  mode: VideoOutputMode;

  label: string;

  description: string;

  creativeFormat: CreativeFormat;

  renderStyle: RenderStyle;

  qualityTier: QualityTier;

  maxAiVideoScenes: number;

  defaultVisualPipeline: VisualPipeline | "auto";

  scaffolded?: boolean;

}



export const VIDEO_OUTPUT_MODE_SPECS: Record<VideoOutputMode, VideoOutputModeSpec> = {

  hybrid_cinematic: {

    mode: "hybrid_cinematic",

    label: "Hybrid Cinematic",

    description:

      "Premium default — kinetic hook, AI I2V for pain/emotion, product screenshots for mechanism/proof, motion CTA.",

    creativeFormat: "pain_led",

    renderStyle: "hybrid_quality",

    qualityTier: "cinematic",

    maxAiVideoScenes: 3,

    defaultVisualPipeline: "image_to_video",

  },

  full_ai_cinematic: {

    mode: "full_ai_cinematic",

    label: "Full AI Cinematic",

    description: "Mostly AI-generated scenes for brand and emotional storytelling.",

    creativeFormat: "pain_led",

    renderStyle: "full_ai_video",

    qualityTier: "cinematic",

    maxAiVideoScenes: 3,

    defaultVisualPipeline: "image_to_video",

  },

  product_demo_motion: {

    mode: "product_demo_motion",

    label: "Product Demo Motion",

    description: "Screenshot-led UI walkthrough with zoom-friendly product proof beats.",

    creativeFormat: "demo_walkthrough",

    renderStyle: "product_demo",

    qualityTier: "standard",

    maxAiVideoScenes: 0,

    defaultVisualPipeline: "slide",

  },

  kinetic_text_ad: {

    mode: "kinetic_text_ad",

    label: "Kinetic Text Ad",

    description: "Premium motion slides with bold on-screen text — voice + music or music only.",

    creativeFormat: "pain_led",

    renderStyle: "slides_only",

    qualityTier: "standard",

    maxAiVideoScenes: 0,

    defaultVisualPipeline: "slide",

  },

  ugc_founder_ad: {

    mode: "ugc_founder_ad",

    label: "UGC Founder Ad",

    description: "Founder POV narrative with slide scaffolding — full UGC capture coming soon.",

    creativeFormat: "founder_story",

    renderStyle: "ugc_style",

    qualityTier: "standard",

    maxAiVideoScenes: 0,

    defaultVisualPipeline: "slide",

    scaffolded: true,

  },

  proof_case_study: {

    mode: "proof_case_study",

    label: "Proof Case Study",

    description: "Metrics, before/after, and credibility slides — minimal AI, maximum proof.",

    creativeFormat: "proof_case_study",

    renderStyle: "slides_only",

    qualityTier: "standard",

    maxAiVideoScenes: 0,

    defaultVisualPipeline: "slide",

  },

};



/** Fast first-pass production defaults. Users can still opt into cinematic modes. */

export const DEFAULT_PRODUCTION_PRESET = VIDEO_OUTPUT_MODE_SPECS.kinetic_text_ad;



export const DEFAULT_PRODUCTION_QUALITY_OPTIONS = {

  videoOutputMode: "kinetic_text_ad" as const,

  creativeFormat: "pain_led" as const,

  qualityTier: "standard" as const,

  visualPipeline: "slide" as const,

  maxAiVideoScenes: 0,

  audioMode: "voiceover_bgm" as const,

  requireSceneReview: false,

  fallbackOnBadAiScene: "replace_with_motion_slide" as const,

};



const LEGACY_OUTPUT_MODE_MAP: Record<LegacyVideoOutputMode, VideoOutputMode> = {

  fast_draft: "kinetic_text_ad",

  hybrid_quality: "hybrid_cinematic",

  full_ai_video: "full_ai_cinematic",

  product_demo: "product_demo_motion",

  text_ad: "kinetic_text_ad",

};



/** Default hybrid cinematic scene plan — purpose → render method. */

const HYBRID_SCENE_SEQUENCE: Array<{

  purpose: SceneContract["purpose"];

  method: SceneRenderMethod;

  reason: string;

  qualityRisk: "low" | "medium" | "high";

}> = [

  {

    purpose: "hook",

    method: "kinetic_slide",

    reason: "Kinetic motion slide for scroll-stop hook",

    qualityRisk: "low",

  },

  {

    purpose: "problem",

    method: "ai_broll",

    reason: "Cinematic I2V b-roll visualizes pain and emotion",

    qualityRisk: "medium",

  },

  {

    purpose: "mechanism",

    method: "screenshot",

    reason: "Product screenshot shows the mechanism or feature",

    qualityRisk: "low",

  },

  {

    purpose: "proof",

    method: "metric_slide",

    reason: "Metric slide for credibility and proof",

    qualityRisk: "low",

  },

  {

    purpose: "cta",

    method: "motion_slide",

    reason: "Motion CTA end card drives conversion",

    qualityRisk: "low",

  },

];



function methodForRenderStyle(

  base: SceneRenderMethod,

  renderStyle: RenderStyle,

  qualityTier: QualityTier,

  falConfigured: boolean

): SceneRenderMethod {

  if (renderStyle === "slides_only" || qualityTier === "draft" || !falConfigured) {

    if (base === "ai_broll") {

      return "slide";

    }

    if (base === "kinetic_slide" || base === "motion_slide" || base === "metric_slide") {

      return base;

    }

    if (base === "product_demo") return "screenshot";

    return base === "screenshot" ? "screenshot" : "slide";

  }

  if (renderStyle === "full_ai_video") {

    if (base === "screenshot") return qualityTier === "cinematic" ? "ai_broll" : "screenshot";

    if (base === "kinetic_slide" || base === "motion_slide" || base === "metric_slide") {

      return base;

    }

    return base;

  }

  if (renderStyle === "product_demo") {

    if (base === "ai_broll") return "screenshot";

    return base === "product_demo" ? "screenshot" : base;

  }

  if (renderStyle === "hybrid_quality") {

    if (base === "ai_broll") return falConfigured ? "ai_broll" : "slide";

    return base;
  }
  return base;
}

/** Build explicit per-scene render assignments for a creative + render combo. */
export function buildSceneRenderPlan(input: {
  creativeFormat: CreativeFormat;
  renderStyle: RenderStyle;
  qualityTier: QualityTier;
  falConfigured?: boolean;
}): SceneRenderPlanEntry[] {
  const falConfigured = input.falConfigured ?? false;
  let sequence = [...HYBRID_SCENE_SEQUENCE];

  if (input.creativeFormat === "objection_handler") {
    sequence = [
      { purpose: "hook", method: "kinetic_slide", reason: "Myth hook slide", qualityRisk: "low" },
      { purpose: "problem", method: "slide", reason: "MYTH overlay", qualityRisk: "low" },
      { purpose: "mechanism", method: "slide", reason: "REALITY rebuttal", qualityRisk: "low" },
      { purpose: "proof", method: "metric_slide", reason: "Evidence beat", qualityRisk: "low" },
      { purpose: "cta", method: "motion_slide", reason: "CTA end card", qualityRisk: "low" },
    ];
  } else if (input.creativeFormat === "comparison") {
    sequence = [
      { purpose: "hook", method: "kinetic_slide", reason: "Category hook", qualityRisk: "low" },
      { purpose: "problem", method: "slide", reason: "THEM split slide", qualityRisk: "low" },
      { purpose: "mechanism", method: "slide", reason: "US split slide", qualityRisk: "low" },
      { purpose: "proof", method: "metric_slide", reason: "Verdict proof", qualityRisk: "low" },
      { purpose: "cta", method: "motion_slide", reason: "CTA end card", qualityRisk: "low" },
    ];
  } else if (input.creativeFormat === "demo_walkthrough") {
    sequence = [
      { purpose: "hook", method: "kinetic_slide", reason: "Workflow hook", qualityRisk: "low" },
      { purpose: "problem", method: "slide", reason: "Manual workflow pain", qualityRisk: "low" },
      {
        purpose: "mechanism",
        method: "screenshot",
        reason: "Product UI walkthrough via screenshot slides",
        qualityRisk: "low",
      },
      {
        purpose: "proof",
        method: "screenshot",
        reason: "Finished-state screenshot",
        qualityRisk: "low",
      },
      { purpose: "cta", method: "motion_slide", reason: "CTA end card", qualityRisk: "low" },
    ];
  } else if (input.creativeFormat === "founder_story") {
    sequence = [
      { purpose: "hook", method: "kinetic_slide", reason: "Founder POV hook", qualityRisk: "low" },
      { purpose: "problem", method: "slide", reason: "Origin story context", qualityRisk: "low" },
      { purpose: "mechanism", method: "slide", reason: "Why we built this", qualityRisk: "low" },
      { purpose: "proof", method: "metric_slide", reason: "Traction or insight", qualityRisk: "low" },
      { purpose: "cta", method: "motion_slide", reason: "CTA end card", qualityRisk: "low" },
    ];
  } else if (input.creativeFormat === "proof_case_study") {
    sequence = [
      { purpose: "hook", method: "kinetic_slide", reason: "Result hook", qualityRisk: "low" },
      { purpose: "problem", method: "slide", reason: "Before state", qualityRisk: "low" },
      { purpose: "mechanism", method: "slide", reason: "What changed", qualityRisk: "low" },
      { purpose: "proof", method: "metric_slide", reason: "Metrics and outcomes", qualityRisk: "low" },
      { purpose: "cta", method: "motion_slide", reason: "CTA end card", qualityRisk: "low" },
    ];
  } else if (input.renderStyle === "full_ai_video") {
    sequence = [
      { purpose: "hook", method: "kinetic_slide", reason: "Hook slide bookend", qualityRisk: "low" },
      {
        purpose: "problem",
        method: "ai_broll",
        reason: "Full AI — pain/emotion scene",
        qualityRisk: "medium",
      },
      {
        purpose: "mechanism",
        method: "ai_broll",
        reason: "Full AI — mechanism scene",
        qualityRisk: "medium",
      },
      { purpose: "proof", method: "metric_slide", reason: "Proof slide for credibility", qualityRisk: "low" },
      { purpose: "cta", method: "motion_slide", reason: "CTA end card", qualityRisk: "low" },
    ];
  } else if (input.renderStyle === "slides_only") {
    sequence = sequence.map((entry) => ({
      ...entry,
      method:
        entry.method === "ai_broll"
          ? "slide"
          : entry.method === "screenshot"
            ? "slide"
            : entry.method,
    }));
  }

  return sequence.map((entry) => ({
    ...entry,
    method: methodForRenderStyle(entry.method, input.renderStyle, input.qualityTier, falConfigured),
  }));
}

/** Whether a scene purpose should use AI b-roll given render style and tier. */
export function shouldUseAiBrollForScene(
  purpose: SceneContract["purpose"],
  renderStyle: RenderStyle,
  qualityTier: QualityTier,
  falConfigured = false
): boolean {
  if (!falConfigured || qualityTier === "draft" || renderStyle === "slides_only") return false;
  if (renderStyle === "full_ai_video") {
    return purpose === "problem" || purpose === "mechanism";
  }
  if (renderStyle === "hybrid_quality") {
    return purpose === "problem";
  }
  return false;
}

export function sceneRenderMethodToVisualMethod(
  method: SceneRenderMethod
): SceneContract["visual_method"] {
  switch (method) {
    case "ai_broll":
      return "ai_broll";
    case "screenshot":
      return "screenshot";
    case "product_demo":
      return "screenshot";
    case "kinetic_slide":
    case "metric_slide":
    case "motion_slide":
    case "slide":
    default:
      return "slide";
  }
}

export function sceneRenderMethodToSlideStyle(
  method: SceneRenderMethod
): "kinetic" | "metric" | "motion" | "default" {
  switch (method) {
    case "kinetic_slide":
      return "kinetic";
    case "metric_slide":
      return "metric";
    case "motion_slide":
      return "motion";
    default:
      return "default";
  }
}

export function maxFalScenesForTier(qualityTier: QualityTier, renderStyle: RenderStyle): number {
  return maxAiVideoScenesForTier(qualityTier, renderStyle);
}

export function maxAiVideoScenesForTier(qualityTier: QualityTier, renderStyle: RenderStyle): number {
  if (renderStyle === "slides_only") return 0;
  if (qualityTier === "draft") return 0;
  if (qualityTier === "cinematic") return 3;
  if (renderStyle === "full_ai_video") return 3;
  if (renderStyle === "hybrid_quality") return 3;
  return 0;
}

export function resolveVideoOutputMode(
  mode: VideoOutputMode | LegacyVideoOutputMode | string | null | undefined
): VideoOutputModeSpec {
  if (!mode) return DEFAULT_PRODUCTION_PRESET;
  const legacy = LEGACY_OUTPUT_MODE_MAP[mode as LegacyVideoOutputMode];
  if (legacy) return VIDEO_OUTPUT_MODE_SPECS[legacy];
  const parsed = VideoOutputModeSchema.safeParse(mode);
  return parsed.success ? VIDEO_OUTPUT_MODE_SPECS[parsed.data] : DEFAULT_PRODUCTION_PRESET;
}

/** Map legacy production_format → creative format + render style. */
export function legacyProductionFormatToCreative(input: ProductionFormat): {
  creativeFormat: CreativeFormat;
  renderStyle: RenderStyle;
  qualityTier: QualityTier;
  videoOutputMode: VideoOutputMode;
} {
  switch (input) {
    case "slide":
      return {
        creativeFormat: "pain_led",
        renderStyle: "slides_only",
        qualityTier: "draft",
        videoOutputMode: "kinetic_text_ad",
      };
    case "pain_led":
      return {
        creativeFormat: "pain_led",
        renderStyle: "hybrid_quality",
        qualityTier: "cinematic",
        videoOutputMode: "hybrid_cinematic",
      };
    case "ai_broll_short":
      return {
        creativeFormat: "pain_led",
        renderStyle: "full_ai_video",
        qualityTier: "cinematic",
        videoOutputMode: "full_ai_cinematic",
      };
    case "objection":
      return {
        creativeFormat: "objection_handler",
        renderStyle: "slides_only",
        qualityTier: "standard",
        videoOutputMode: "kinetic_text_ad",
      };
    case "comparison":
      return {
        creativeFormat: "comparison",
        renderStyle: "slides_only",
        qualityTier: "standard",
        videoOutputMode: "kinetic_text_ad",
      };
    default:
      return {
        creativeFormat: "pain_led",
        renderStyle: "hybrid_quality",
        qualityTier: "cinematic",
        videoOutputMode: "hybrid_cinematic",
      };
  }
}

/** Derive legacy production_format for DB rows that only store the old field. */
export function deriveLegacyProductionFormat(input: {
  renderStyle: RenderStyle;
  creativeFormat: CreativeFormat;
}): ProductionFormat {
  if (input.renderStyle === "full_ai_video") return "ai_broll_short";
  if (input.creativeFormat === "objection_handler") return "objection";
  if (input.creativeFormat === "comparison") return "comparison";
  if (input.renderStyle === "slides_only") return "slide";
  if (input.renderStyle === "hybrid_quality" || input.creativeFormat === "pain_led") return "pain_led";
  if (input.renderStyle === "product_demo") return "pain_led";
  return "pain_led";
}

export function qualityTierToFalRenderMode(tier: QualityTier): FalRenderMode {
  return tier === "draft" ? "fast" : "cinematic";
}

export function coerceCreativeFormat(raw: string | null | undefined): CreativeFormat {
  if (raw === "objection") return "objection_handler";
  const parsed = CreativeFormatSchema.safeParse(raw);
  return parsed.success ? parsed.data : "pain_led";
}

export function coerceRenderStyle(raw: string | null | undefined): RenderStyle {
  const parsed = RenderStyleSchema.safeParse(raw);
  return parsed.success ? parsed.data : "hybrid_quality";
}

export function coerceQualityTier(raw: string | null | undefined): QualityTier {
  const parsed = QualityTierSchema.safeParse(raw);
  return parsed.success ? parsed.data : "cinematic";
}

export function coerceVideoOutputMode(raw: string | null | undefined): VideoOutputMode {
  if (!raw) return DEFAULT_PRODUCTION_PRESET.mode;
  const legacy = LEGACY_OUTPUT_MODE_MAP[raw as LegacyVideoOutputMode];
  if (legacy) return legacy;
  const parsed = VideoOutputModeSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PRODUCTION_PRESET.mode;
}

export function coerceFallbackOnBadAiScene(
  raw: string | null | undefined
): FallbackOnBadAiScene {
  const parsed = FallbackOnBadAiSceneSchema.safeParse(raw);
  return parsed.success ? parsed.data : DEFAULT_PRODUCTION_QUALITY_OPTIONS.fallbackOnBadAiScene;
}
