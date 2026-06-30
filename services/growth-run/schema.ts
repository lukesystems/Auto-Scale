import { z } from "zod";
import {
  coerceAccountType,
  coerceAssetMethod,
  coerceDiscoveryQuery,
  coerceHypotheses,
  coercePatternType,
  coerceToString,
  parseFollowerCount,
} from "@/services/ai/coerce-llm-output";
import {
  ProductionFormatSchema,
  AudioModeSchema,
  FalRenderModeSchema,
  FalModelTierSchema,
} from "@/services/video-factory/production-options";
import { normalizePreferredLengthSeconds } from "./normalize-preferred-length";
import {
  confidenceScoreField,
  defaultStringField,
  enumField,
  looseUrlField,
  minStringArrayField,
  recordEnumMixField,
} from "@/lib/zod-coerce";

export { normalizePreferredLengthSeconds } from "./normalize-preferred-length";

/**
 * Shared Zod contracts for the Growth Run spine.
 *
 * Every AI agent that contributes to a Growth Run validates its structured
 * output through one of these schemas. They are the contract between the
 * orchestrator, the database, and the UI.
 */

export const PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export type Platform = (typeof PLATFORMS)[number];

export const VIDEO_TYPES = [
  "slide",
  "demo",
  "founder_pov",
  "pain_led",
  "trend_remix",
  "ai_broll",
  "objection",
  "comparison",
  "carousel",
] as const;
export type VideoType = (typeof VIDEO_TYPES)[number];

export const ASSET_METHODS = [
  "slide",
  "fal_clip",
  "screen_demo",
  "stock",
  "image",
  "user_upload",
] as const;
export type AssetMethod = (typeof ASSET_METHODS)[number];

export const SCENE_ROLES = [
  "hook",
  "context",
  "demo",
  "proof",
  "cta",
  "outro",
  "transition",
] as const;

// ------------------------------------------------------------------
// VideoTrend report
// ------------------------------------------------------------------

export const HookPatternSchema = z.object({
  label: defaultStringField("Hook pattern"),
  pattern: defaultStringField("Opening hook"),
  reference_url: looseUrlField("https://example.com/evidence"),
  example: z.string().optional(),
  when_to_use: z.string().optional(),
});

export const WinningStructureSchema = z.object({
  name: defaultStringField("Winning structure"),
  beats: minStringArrayField(["hook", "value", "cta"]),
  ideal_length_seconds: z.preprocess(
    (value) => {
      const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
      return Number.isFinite(n) && n > 0 ? n : 22;
    },
    z.number().int().positive()
  ),
  why_it_works: defaultStringField("Structure matches observed short-form patterns in this niche."),
});

export const CtaPatternSchema = z.object({
  label: defaultStringField("CTA"),
  pattern: defaultStringField("Call to action"),
  best_for: z.array(z.string()).default([]),
});

export const PlatformPatternSchema = z.object({
  platform: enumField(PLATFORMS, "tiktok", {
    tiktok: "tiktok",
    instagram: "instagram",
    ig: "instagram",
    reels: "instagram",
    youtube: "youtube",
    shorts: "youtube",
  }),
  preferred_length_seconds: z.preprocess(
    normalizePreferredLengthSeconds,
    z.tuple([z.number(), z.number()]).optional()
  ),
  preferred_aspect_ratio: z.string().default("9:16"),
  notes: z.string().optional(),
});

export const RecommendedExperimentSchema = z.object({
  hypothesis: defaultStringField("Test whether this format drives qualified engagement."),
  video_type: enumField(VIDEO_TYPES, "demo"),
  platform: enumField(PLATFORMS, "tiktok"),
  ideal_length_seconds: z.preprocess(
    (value) => {
      const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
      return Number.isFinite(n) && n > 0 ? n : 22;
    },
    z.number().int().positive()
  ),
  estimated_variants: z.preprocess(
    (value) => {
      const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
      return Number.isFinite(n) && n >= 1 ? Math.min(n, 20) : 3;
    },
    z.number().int().min(1).max(20)
  ).default(3),
  rationale: defaultStringField("Based on observed niche patterns."),
});

const DEFAULT_WINNING_STRUCTURE = {
  name: "Hook → proof → CTA",
  beats: ["Open with a pain hook", "Show the product solving it", "Close with a clear CTA"],
  ideal_length_seconds: 22,
  why_it_works: "Default structure when evidence is thin.",
};

const DEFAULT_HOOK_PATTERN = {
  label: "Pain-led opener",
  pattern: "Still doing this manually?",
  reference_url: "https://example.com/evidence",
};

const DEFAULT_CTA_PATTERN = {
  label: "Direct CTA",
  pattern: "Try it free — link in bio",
  best_for: ["founders", "operators"],
};

const DEFAULT_PLATFORM_PATTERN = {
  platform: "tiktok" as const,
  preferred_aspect_ratio: "9:16",
};

const DEFAULT_EXPERIMENT = {
  hypothesis: "Short demo video will drive product interest.",
  video_type: "demo" as const,
  platform: "tiktok" as const,
  ideal_length_seconds: 22,
  estimated_variants: 3,
  rationale: "Conservative default experiment when evidence is sparse.",
};

export const VideoTrendReportSchema = z.object({
  winning_structures: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) return [DEFAULT_WINNING_STRUCTURE];
      return value;
    },
    z.array(WinningStructureSchema).min(1)
  ),
  hook_patterns: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) return [DEFAULT_HOOK_PATTERN];
      return value;
    },
    z.array(HookPatternSchema).min(1)
  ),
  opening_frames: minStringArrayField(["On-screen text stating the core pain point"]),
  cta_patterns: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) return [DEFAULT_CTA_PATTERN];
      return value;
    },
    z.array(CtaPatternSchema).min(1)
  ),
  audience_language: z.array(z.string()).default([]),
  platform_patterns: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) return [DEFAULT_PLATFORM_PATTERN];
      return value;
    },
    z.array(PlatformPatternSchema).min(1)
  ),
  recommended_experiments: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) return [DEFAULT_EXPERIMENT];
      return value;
    },
    z.array(RecommendedExperimentSchema).min(1)
  ),
  competitor_gaps: z.array(z.string()).default([]),
  repurposable_formats: z.array(z.string()).default([]),
  confidence: confidenceScoreField(0.5),
});

export type VideoTrendReport = z.infer<typeof VideoTrendReportSchema>;

// ------------------------------------------------------------------
// Video strategy + posting loadout
// ------------------------------------------------------------------

export const PlatformMixSchema = recordEnumMixField(PLATFORMS, "tiktok");
export const VideoTypeMixSchema = recordEnumMixField(VIDEO_TYPES, "slide");

export const CampaignHypothesisSchema = z.object({
  hypothesis: defaultStringField("Test a short-form format against baseline engagement."),
  metric_to_watch: defaultStringField("qualified_clicks"),
  success_threshold: z.string().optional(),
  kill_threshold: z.string().optional(),
});

export const VideoStrategySchema = z.object({
  platform_mix: PlatformMixSchema,
  video_type_mix: VideoTypeMixSchema,
  campaign_hypotheses: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return [
          {
            hypothesis: "Pain-led demo will drive qualified product interest.",
            metric_to_watch: "product_link_clicks",
          },
        ];
      }
      return value;
    },
    z.array(CampaignHypothesisSchema).min(1)
  ),
  rationale: defaultStringField("Mix prioritizes formats supported by available evidence."),
});

export type VideoStrategy = z.infer<typeof VideoStrategySchema>;

export const PerAccountPlanSchema = z.object({
  connected_account_id: z.string().uuid(),
  platform: z.enum(PLATFORMS),
  handle: z.string(),
  videos_per_day: z.number().min(0).max(50),
  video_type_focus: z.array(z.enum(VIDEO_TYPES)).default([]),
});

export const PostingLoadoutSchema = z.object({
  // May be empty: AutoScale still generates videos and keeps them in an
  // internal queue / export mode when no Postiz accounts are connected.
  per_account_plan: z.array(PerAccountPlanSchema).default([]),
  total_videos_planned: z.number().int().min(1),
  duration_days: z.number().int().min(1).max(60).default(7),
});

export type PostingLoadout = z.infer<typeof PostingLoadoutSchema>;

// ------------------------------------------------------------------
// Concepts → scripts → storyboards
// ------------------------------------------------------------------

export const VideoConceptSchema = z.object({
  video_type: z.enum(VIDEO_TYPES),
  platform: z.enum(PLATFORMS),
  target_length_seconds: z.number().int().min(6).max(180),
  hook: z.string().min(3),
  angle: z.string(),
  promise: z.string(),
  cta: z.string(),
  hypothesis: z.string(),
});

export const VideoConceptBatchSchema = z.object({
  concepts: z.array(VideoConceptSchema).min(1).max(40),
});

export type VideoConcept = z.infer<typeof VideoConceptSchema>;

export const VideoScriptSchema = z.object({
  hook_line: z.string().min(3),
  body_lines: z.array(z.string()).min(1),
  cta_line: z.string(),
  voiceover_full: z.string(),
  on_screen_text: z.array(z.string()).default([]),
  estimated_duration_seconds: z.number().int().positive(),
});

export type VideoScript = z.infer<typeof VideoScriptSchema>;

export const StoryboardSceneSchema = z.object({
  scene_index: z.number().int().min(0),
  role: z.enum(SCENE_ROLES),
  duration_seconds: z.number().positive(),
  visual_intent: z.string(),
  on_screen_text: z
    .preprocess((val) => coerceToString(val), z.string().optional().default("")),
  voiceover_line: z
    .preprocess((val) => coerceToString(val), z.string().optional().default("")),
  asset_method: z
    .preprocess((val) => coerceAssetMethod(val), z.enum(ASSET_METHODS).default("slide")),
  asset_prompt: z
    .preprocess((val) => coerceToString(val), z.string().optional().default("")),
});

export const StoryboardSchema = z.object({
  aspect_ratio: z.string().default("9:16"),
  total_duration_seconds: z.number().positive(),
  scenes: z.array(StoryboardSceneSchema).min(2),
  notes: z.string().optional().default(""),
});

export type Storyboard = z.infer<typeof StoryboardSchema>;

// ------------------------------------------------------------------
// Compound classification
// ------------------------------------------------------------------

export const ExperimentClassificationSchema = z.object({
  classification: z.enum(["winner", "promising", "flat", "kill"]),
  diagnosis: z.string(),
  next_action: z.enum([
    "variant",
    "rewrite_hook",
    "rewrite_cta",
    "retarget",
    "kill",
    "increase_volume",
    "review",
  ]),
  confidence: z.number().min(0).max(1),
});

export type ExperimentClassification = z.infer<typeof ExperimentClassificationSchema>;

// ------------------------------------------------------------------
// Growth Run options (user input on creation)
// ------------------------------------------------------------------

export const GrowthRunOptionsSchema = z.object({
  target_platforms: z.array(z.enum(PLATFORMS)).default(["tiktok"]),
  approval_mode: z.enum(["manual", "per_format", "autopilot"]).default("manual"),
  posting_aggressiveness: z.enum(["conservative", "balanced", "aggressive"]).default("conservative"),
  duration_days: z.number().int().min(1).max(60).default(1),
  brand_constraints: z.record(z.unknown()).default({}),
  connected_account_ids: z.array(z.string().uuid()).default([]),
  distribution_mode: z.enum(["postiz", "export_only"]).default("postiz"),
  concept_target_count: z.number().int().min(1).max(40).default(3),
  /** Dev / emergency: allow scheduling videos with silent TTS fallback */
  allow_silent_voiceover: z.boolean().default(false),
  /** User-selected production format for Stage 3 render */
  production_format: ProductionFormatSchema.optional(),
  /** User-selected audio mode for Stage 3 render */
  audio_mode: AudioModeSchema.optional(),
  /** cinematic = fal middle scenes; fast = slides only */
  fal_render_mode: FalRenderModeSchema.optional(),
  /** Override fal model tier; auto derives from render mode + scene purpose */
  fal_model_tier: FalModelTierSchema.optional(),
  /** User acknowledged low-evidence render for this run */
  low_evidence_acknowledged: z.boolean().optional(),
});

export type GrowthRunOptions = z.infer<typeof GrowthRunOptionsSchema>;
