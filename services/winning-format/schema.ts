import { z } from "zod";
import { PLATFORMS, VIDEO_TYPES } from "@/services/growth-run/schema";
import {
  confidenceScoreField,
  coerceUuidList,
  defaultStringField,
  enumField,
  minStringArrayField,
} from "@/lib/zod-coerce";

export const FORMAT_TEST_VARIABLES = ["hook", "format"] as const;

const DISTORTION_RISK = ["low", "medium", "high", "unknown"] as const;

const DEFAULT_VARIANT = {
  variant_label: "A",
  hook: "Still doing this manually?",
  angle: "Pain-led opener",
  promise: "Show a faster workflow",
  hypothesis: "Pain hook will lift watch-through",
  expected_signal: "higher completion rate",
};

export const HookVariantSchema = z.object({
  variant_label: defaultStringField("A"),
  hook: defaultStringField("Opening hook"),
  angle: defaultStringField("Angle"),
  promise: defaultStringField("Core promise"),
  hypothesis: defaultStringField("Test hypothesis"),
  expected_signal: defaultStringField("completion_rate"),
});

export const FormatHypothesisSchema = z.object({
  format_name: defaultStringField("Controlled format test"),
  video_type: enumField(VIDEO_TYPES, "slide"),
  platform: enumField(PLATFORMS, "tiktok"),
  target_length_seconds: z.preprocess(
    (value) => {
      const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
      if (!Number.isFinite(n)) return 22;
      return Math.min(60, Math.max(8, n));
    },
    z.number().int().min(8).max(60)
  ),
  hook_mechanism: defaultStringField("Pain-led hook"),
  visual_grammar: defaultStringField("Screen demo with bold on-screen text"),
  script_structure: minStringArrayField(["Hook", "Context", "CTA"]),
  cta_pattern: defaultStringField("Try free — link in bio"),
  business_hypothesis: defaultStringField("This format will drive qualified interest."),
  transferability_score: confidenceScoreField(0.5),
  distortion_risk: enumField(DISTORTION_RISK, "unknown"),
  confidence: confidenceScoreField(0.5),
  missing_evidence: z.array(z.string()).default([]),
  evidence_video_ids: z.preprocess(coerceUuidList, z.array(z.string().uuid()).default([])),
  source_pattern_ids: z.preprocess(coerceUuidList, z.array(z.string().uuid()).default([])),
  observed_evidence: minStringArrayField(["Pattern observed in niche evidence."]),
  strategic_inference: minStringArrayField(["Format should transfer to this product audience."]),
  variants: z.preprocess(
    (value) => {
      if (!Array.isArray(value)) return [DEFAULT_VARIANT, DEFAULT_VARIANT, DEFAULT_VARIANT];
      const parsed = value.slice(0, 3);
      while (parsed.length < 3) parsed.push({ ...DEFAULT_VARIANT, variant_label: String.fromCharCode(65 + parsed.length) });
      return parsed;
    },
    z.array(HookVariantSchema).length(3)
  ),
});

export const WinningFormatPlanSchema = z.object({
  audience_pain: defaultStringField("Audience pain not fully specified."),
  fixed_body: defaultStringField("Show the product solving the pain in under 20 seconds."),
  fixed_cta: defaultStringField("Try it free"),
  fixed_audience: defaultStringField("Target audience for this product."),
  tested_variable: z.enum(FORMAT_TEST_VARIABLES).default("hook"),
  evaluation_window_days: z.preprocess(
    (value) => {
      const n = typeof value === "number" ? value : Number.parseInt(String(value), 10);
      return Number.isFinite(n) ? Math.min(30, Math.max(1, n)) : 3;
    },
    z.number().int().min(1).max(30)
  ).default(3),
  formats: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return [{ format_name: "Default controlled test" }];
      }
      return value.slice(0, 2);
    },
    z.array(FormatHypothesisSchema).min(1).max(2)
  ),
});

export const WinnerVariantSchema = z.object({
  variant_label: defaultStringField("A"),
  hook: defaultStringField("Opening hook"),
  angle: defaultStringField("Angle"),
  hypothesis: defaultStringField("Hypothesis"),
  expected_signal: defaultStringField("completion_rate"),
});

export const WinnerVariantBatchSchema = z.object({
  variants: z.preprocess(
    (value) => {
      if (!Array.isArray(value)) return [DEFAULT_VARIANT, DEFAULT_VARIANT, DEFAULT_VARIANT];
      const parsed = value.slice(0, 3);
      while (parsed.length < 3) parsed.push({ ...DEFAULT_VARIANT, variant_label: String.fromCharCode(65 + parsed.length) });
      return parsed;
    },
    z.array(WinnerVariantSchema).length(3)
  ),
});

export type WinningFormatPlan = z.infer<typeof WinningFormatPlanSchema>;
export type FormatHypothesis = z.infer<typeof FormatHypothesisSchema>;
