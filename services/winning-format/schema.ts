import { z } from "zod";
import { PLATFORMS, VIDEO_TYPES } from "@/services/growth-run/schema";

export const FORMAT_TEST_VARIABLES = ["hook", "format"] as const;

export const HookVariantSchema = z.object({
  variant_label: z.string().min(1).max(40),
  hook: z.string().min(3).max(180),
  angle: z.string().min(3),
  promise: z.string().min(3),
  hypothesis: z.string().min(3),
  expected_signal: z.string().min(3),
});

export const FormatHypothesisSchema = z.object({
  format_name: z.string().min(3).max(120),
  video_type: z.enum(VIDEO_TYPES),
  platform: z.enum(PLATFORMS),
  target_length_seconds: z.number().int().min(8).max(60),
  hook_mechanism: z.string().min(3),
  visual_grammar: z.string().min(3),
  script_structure: z.array(z.string().min(1)).min(3).max(8),
  cta_pattern: z.string().min(3),
  business_hypothesis: z.string().min(3),
  transferability_score: z.number().min(0).max(1),
  distortion_risk: z.enum(["low", "medium", "high", "unknown"]),
  confidence: z.number().min(0).max(1),
  missing_evidence: z.array(z.string()).default([]),
  evidence_video_ids: z.array(z.string().uuid()).default([]),
  source_pattern_ids: z.array(z.string().uuid()).default([]),
  observed_evidence: z.array(z.string()).min(1),
  strategic_inference: z.array(z.string()).min(1),
  variants: z.array(HookVariantSchema).length(3),
});

export const WinningFormatPlanSchema = z.object({
  audience_pain: z.string().min(3),
  fixed_body: z.string().min(3),
  fixed_cta: z.string().min(1),
  fixed_audience: z.string().min(3),
  tested_variable: z.enum(FORMAT_TEST_VARIABLES).default("hook"),
  evaluation_window_days: z.number().int().min(1).max(30).default(3),
  formats: z.array(FormatHypothesisSchema).min(1).max(2),
});

export const WinnerVariantSchema = z.object({
  variant_label: z.string().min(1).max(40),
  hook: z.string().min(3).max(180),
  angle: z.string().min(3),
  hypothesis: z.string().min(3),
  expected_signal: z.string().min(3),
});

export const WinnerVariantBatchSchema = z.object({
  variants: z.array(WinnerVariantSchema).length(3),
});

export type WinningFormatPlan = z.infer<typeof WinningFormatPlanSchema>;
export type FormatHypothesis = z.infer<typeof FormatHypothesisSchema>;
