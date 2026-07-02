import { z } from "zod";

export const BriefConfidenceLevelSchema = z.enum(["low", "medium", "high"]);
export type BriefConfidenceLevel = z.infer<typeof BriefConfidenceLevelSchema>;

export const StringArraySchema = z.preprocess((value) => {
  if (typeof value === "string") return value.trim() ? [value] : [];
  return value;
}, z.array(z.string()).default([]));

const CONFIDENCE_LEVEL_TO_SCORE: Record<string, number> = {
  low: 0.35,
  medium: 0.55,
  high: 0.85,
};

function coerceConfidenceScore(value: unknown, fallback = 0.5): number {
  if (typeof value === "number" && !Number.isNaN(value)) {
    return Math.min(1, Math.max(0, value));
  }
  if (typeof value === "string") {
    const key = value.trim().toLowerCase();
    if (key in CONFIDENCE_LEVEL_TO_SCORE) return CONFIDENCE_LEVEL_TO_SCORE[key]!;
    const parsed = Number.parseFloat(key);
    if (!Number.isNaN(parsed)) return Math.min(1, Math.max(0, parsed));
  }
  return fallback;
}

const confidenceScoreField = z.preprocess(
  (value) => coerceConfidenceScore(value),
  z.number().min(0).max(1)
);

/** Coerce missing/empty model output into a safe default string. */
function defaultReasonField(fallback: string) {
  return z.preprocess(
    (value) => (typeof value === "string" && value.trim() ? value.trim() : fallback),
    z.string()
  );
}

function coerceRequiredString(value: unknown, fallback: string): string {
  if (typeof value === "string" && value.trim()) return value.trim();
  if (value && typeof value === "object" && !Array.isArray(value)) {
    const record = value as Record<string, unknown>;
    for (const key of ["description", "summary", "label", "name", "segment", "audience", "persona"]) {
      if (typeof record[key] === "string" && record[key].trim()) {
        return (record[key] as string).trim();
      }
    }
    return JSON.stringify(value).slice(0, 500);
  }
  return fallback;
}

function requiredStringField(fallback: string) {
  return z.preprocess((value) => coerceRequiredString(value, fallback), z.string());
}

export const AutoBriefCompetitorSchema = z.object({
  name: z.string(),
  url: z.string().nullable().optional(),
  reason: defaultReasonField("Likely alternative or competitor in this product category"),
  confidence: z.union([z.number().min(0).max(1), BriefConfidenceLevelSchema]),
});

export const AutoBriefSourceSchema = z.object({
  platform: z.string().nullable().optional(),
  url: z.string().nullable().optional(),
  reason: defaultReasonField("Public source worth monitoring for this niche"),
  confidence: confidenceScoreField,
});

export const AutoBriefProductionConstraintsSchema = z.object({
  can_make_carousels: z.boolean().default(true),
  can_make_founder_videos: z.boolean().default(false),
  can_use_product_screenshots: z.boolean().default(true),
  can_use_ai_images: z.boolean().default(true),
});

export const AutoBriefSchema = z.object({
  product_name: requiredStringField("Unknown product"),
  product_url: z.string(),
  one_line_description: z.string().default(""),
  category: z.string().default(""),
  product_type: z.string().default(""),
  product_summary: requiredStringField("Product summary not available from crawl"),
  what_it_does: z.string().default(""),
  target_customer: requiredStringField("Target customer not clearly stated on the product site"),
  target_audience: StringArraySchema,
  primary_pain: requiredStringField("Primary pain not clearly stated on the product site"),
  user_pain_points: StringArraySchema,
  core_promise: requiredStringField("Core promise not clearly stated on the product site"),
  key_features: StringArraySchema,
  key_benefits: StringArraySchema,
  offer: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  niche: requiredStringField("General SaaS"),
  alternative_solutions: StringArraySchema,
  market_category: z.string().default(""),
  positioning_angles: StringArraySchema,
  content_pillars: StringArraySchema,
  content_angles: StringArraySchema,
  platform_recommendations: z
    .array(
      z.object({
        platform: z.string(),
        reason: defaultReasonField("Recommended platform for this product's audience"),
      })
    )
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
  confidence_score: confidenceScoreField,
  missing_information: StringArraySchema,
});

export type AutoBrief = z.infer<typeof AutoBriefSchema>;

export const LOW_CONFIDENCE_THRESHOLD = 0.55;
