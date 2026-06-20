import { z } from "zod";

export const BriefConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export type BriefConfidenceLevel = z.infer<typeof BriefConfidenceLevelSchema>;

export const StringArraySchema = z.preprocess((value) => {
  if (typeof value === "string") return value.trim() ? [value] : [];
  return value;
}, z.array(z.string()).default([]));

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
  target_audience: StringArraySchema,
  primary_pain: z.string(),
  user_pain_points: StringArraySchema,
  core_promise: z.string(),
  key_features: StringArraySchema,
  key_benefits: StringArraySchema,
  offer: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  niche: z.string(),
  alternative_solutions: StringArraySchema,
  market_category: z.string().default(""),
  positioning_angles: StringArraySchema,
  content_pillars: StringArraySchema,
  content_angles: StringArraySchema,
  platform_recommendations: z
    .array(z.object({ platform: z.string(), reason: z.string() }))
    .default([]),
  cta_suggestions: StringArraySchema,
  founder_led_opportunities: StringArraySchema,
  positioning_gaps: StringArraySchema,
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
  extraction_notes: StringArraySchema,
  confidence_score: z.number().min(0).max(1),
  missing_information: StringArraySchema,
});

export type AutoBrief = z.infer<typeof AutoBriefSchema>;

export const LOW_CONFIDENCE_THRESHOLD = 0.55;
