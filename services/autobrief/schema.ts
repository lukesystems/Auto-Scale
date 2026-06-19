import { z } from "zod";

export const BriefConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export type BriefConfidenceLevel = z.infer<typeof BriefConfidenceLevelSchema>;

export const AutoBriefCompetitorSchema = z.object({
  name: z.string(),
  url: z.string().nullable().optional(),
  reason: z.string(),
  confidence: z.union([z.number().min(0).max(1), BriefConfidenceLevelSchema]),
});

export const AutoBriefSourceSchema = z.object({
  platform: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
});

export const AutoBriefProductionConstraintsSchema = z.object({
  can_make_carousels: z.boolean().default(true),
  can_make_founder_videos: z.boolean().default(false),
  can_use_product_screenshots: z.boolean().default(true),
  can_use_ai_images: z.boolean().default(true),
});

export const AutoBriefSchema = z.object({
  product_name: z.string(),
  product_url: z.string(),
  one_line_description: z.string().default(""),
  category: z.string().default(""),
  product_type: z.string().default(""),
  product_summary: z.string(),
  what_it_does: z.string().default(""),
  target_customer: z.string(),
  target_audience: z.array(z.string()).default([]),
  primary_pain: z.string(),
  user_pain_points: z.array(z.string()).default([]),
  core_promise: z.string(),
  key_features: z.array(z.string()).default([]),
  key_benefits: z.array(z.string()).default([]),
  offer: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  niche: z.string(),
  alternative_solutions: z.array(z.string()).default([]),
  market_category: z.string().default(""),
  positioning_angles: z.array(z.string()).default([]),
  content_pillars: z.array(z.string()).default([]),
  content_angles: z.array(z.string()).default([]),
  platform_recommendations: z
    .array(z.object({ platform: z.string(), reason: z.string() }))
    .default([]),
  cta_suggestions: z.array(z.string()).default([]),
  founder_led_opportunities: z.array(z.string()).default([]),
  positioning_gaps: z.array(z.string()).default([]),
  brand_voice: z.string().nullable().optional(),
  production_constraints: AutoBriefProductionConstraintsSchema.default({
    can_make_carousels: true,
    can_make_founder_videos: false,
    can_use_product_screenshots: true,
    can_use_ai_images: true,
  }),
  suggested_competitors: z.array(AutoBriefCompetitorSchema).default([]),
  suggested_sources: z.array(AutoBriefSourceSchema).default([]),
  confidence: z
    .object({
      overall: BriefConfidenceLevelSchema.default("medium"),
      audience: BriefConfidenceLevelSchema.default("medium"),
      features: BriefConfidenceLevelSchema.default("medium"),
      competitors: BriefConfidenceLevelSchema.default("low"),
      positioning: BriefConfidenceLevelSchema.default("medium"),
    })
    .default({
      overall: "medium",
      audience: "medium",
      features: "medium",
      competitors: "low",
      positioning: "medium",
    }),
  extraction_notes: z.array(z.string()).default([]),
  confidence_score: z.number().min(0).max(1),
  missing_information: z.array(z.string()).default([]),
});

export type AutoBrief = z.infer<typeof AutoBriefSchema>;

export const LOW_CONFIDENCE_THRESHOLD = 0.55;
