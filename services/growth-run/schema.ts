import { z } from "zod";
import { normalizePreferredLengthSeconds } from "./normalize-preferred-length";

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
  label: z.string(),
  pattern: z.string(),
  example: z.string().optional(),
  when_to_use: z.string().optional(),
});

export const WinningStructureSchema = z.object({
  name: z.string(),
  beats: z.array(z.string()).min(2),
  ideal_length_seconds: z.number().int().positive(),
  why_it_works: z.string(),
});

export const CtaPatternSchema = z.object({
  label: z.string(),
  pattern: z.string(),
  best_for: z.array(z.string()).default([]),
});

export const PlatformPatternSchema = z.object({
  platform: z.enum(PLATFORMS),
  preferred_length_seconds: z.preprocess(
    normalizePreferredLengthSeconds,
    z.tuple([z.number(), z.number()]).optional()
  ),
  preferred_aspect_ratio: z.string().default("9:16"),
  notes: z.string().optional(),
});

export const RecommendedExperimentSchema = z.object({
  hypothesis: z.string(),
  video_type: z.enum(VIDEO_TYPES),
  platform: z.enum(PLATFORMS),
  ideal_length_seconds: z.number().int().positive(),
  estimated_variants: z.number().int().min(1).max(20).default(3),
  rationale: z.string(),
});

export const VideoTrendReportSchema = z.object({
  winning_structures: z.array(WinningStructureSchema).min(1),
  hook_patterns: z.array(HookPatternSchema).min(1),
  opening_frames: z.array(z.string()).min(1),
  cta_patterns: z.array(CtaPatternSchema).min(1),
  audience_language: z.array(z.string()).default([]),
  platform_patterns: z.array(PlatformPatternSchema).min(1),
  recommended_experiments: z.array(RecommendedExperimentSchema).min(1),
  competitor_gaps: z.array(z.string()).default([]),
  repurposable_formats: z.array(z.string()).default([]),
  confidence: z.number().min(0).max(1).default(0.5),
});

export type VideoTrendReport = z.infer<typeof VideoTrendReportSchema>;

// ------------------------------------------------------------------
// Video strategy + posting loadout
// ------------------------------------------------------------------

export const PlatformMixSchema = z.record(z.enum(PLATFORMS), z.number().min(0).max(1));
export const VideoTypeMixSchema = z.record(z.enum(VIDEO_TYPES), z.number().min(0).max(1));

export const CampaignHypothesisSchema = z.object({
  hypothesis: z.string(),
  metric_to_watch: z.string(),
  success_threshold: z.string().optional(),
  kill_threshold: z.string().optional(),
});

export const VideoStrategySchema = z.object({
  platform_mix: PlatformMixSchema,
  video_type_mix: VideoTypeMixSchema,
  campaign_hypotheses: z.array(CampaignHypothesisSchema).min(1),
  rationale: z.string(),
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
  on_screen_text: z.string().optional().default(""),
  voiceover_line: z.string().optional().default(""),
  asset_method: z.enum(ASSET_METHODS).default("slide"),
  asset_prompt: z.string().optional().default(""),
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
  target_platforms: z.array(z.enum(PLATFORMS)).default(["tiktok", "instagram", "youtube"]),
  approval_mode: z.enum(["manual", "per_format", "autopilot"]).default("manual"),
  posting_aggressiveness: z.enum(["conservative", "balanced", "aggressive"]).default("balanced"),
  duration_days: z.number().int().min(1).max(60).default(7),
  brand_constraints: z.record(z.unknown()).default({}),
  connected_account_ids: z.array(z.string().uuid()).default([]),
  distribution_mode: z.enum(["postiz", "export_only"]).default("postiz"),
  concept_target_count: z.number().int().min(1).max(40).default(12),
});

export type GrowthRunOptions = z.infer<typeof GrowthRunOptionsSchema>;
