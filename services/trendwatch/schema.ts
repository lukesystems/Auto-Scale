import { z } from "zod";
import {
  coerceAccountType,
  coerceToString,
  parseFollowerCount,
} from "@/services/ai/coerce-llm-output";

export const TrendWatchAnalysisSchema = z.object({
  niche_summary: z.string(),
  competitor_map: z
    .array(
      z.object({
        name: z.string(),
        strength: z.string().default(""),
        weakness: z.string().default(""),
        account_type: z.string().default("unknown"),
      })
    )
    .default([]),
  shadow_account_targets: z.array(z.string()).default([]),
  winning_formats: z
    .array(
      z.object({
        format: z.string(),
        reason: z.string().default(""),
      })
    )
    .default([]),
  hook_opportunities: z.array(z.string()).default([]),
  recommended_experiments: z.array(z.string()).default([]),
  risk_flags: z.array(z.string()).default([]),
});

export type TrendWatchAnalysis = z.infer<typeof TrendWatchAnalysisSchema>;

export const SourceClassificationSchema = z.object({
  account_type: z.preprocess(
    (val) => coerceAccountType(val),
    z.enum(["official", "competitor", "shadow", "creator", "partner", "affiliate", "review", "unknown"])
  ),
  follower_count: z.preprocess(
    (val) => parseFollowerCount(val),
    z.number().int().nonnegative().nullable().default(null)
  ),
  format: z.preprocess((val) => coerceToString(val), z.string().default("")),
  hook: z.preprocess((val) => coerceToString(val), z.string().default("")),
  angle: z.preprocess((val) => coerceToString(val), z.string().default("")),
  visual_pattern: z.preprocess((val) => coerceToString(val), z.string().default("")),
  cta_pattern: z.preprocess((val) => coerceToString(val), z.string().default("")),
  audience_pain: z.preprocess((val) => coerceToString(val), z.string().default("")),
  why_it_worked: z.preprocess((val) => coerceToString(val), z.string().default("")),
  how_to_adapt: z.preprocess((val) => coerceToString(val), z.string().default("")),
  distortion_risk: z.enum(["low", "medium", "high"]).default("medium"),
  transferability_score: z.number().min(0).max(1).default(0.5),
  signal_score: z.number().min(0).max(1).default(0.5),
  recommended_experiments: z.array(z.string()).default([]),
});

export type SourceClassification = z.infer<typeof SourceClassificationSchema>;
