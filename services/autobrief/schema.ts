import { z } from "zod";

export const AutoBriefCompetitorSchema = z.object({
  name: z.string(),
  url: z.string().nullable().optional(),
  reason: z.string(),
  confidence: z.number().min(0).max(1),
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
  product_summary: z.string(),
  target_customer: z.string(),
  primary_pain: z.string(),
  core_promise: z.string(),
  offer: z.string().nullable().optional(),
  cta: z.string().nullable().optional(),
  niche: z.string(),
  positioning_angles: z.array(z.string()).default([]),
  content_pillars: z.array(z.string()).default([]),
  brand_voice: z.string().nullable().optional(),
  production_constraints: AutoBriefProductionConstraintsSchema.default({
    can_make_carousels: true,
    can_make_founder_videos: false,
    can_use_product_screenshots: true,
    can_use_ai_images: true,
  }),
  suggested_competitors: z.array(AutoBriefCompetitorSchema).default([]),
  suggested_sources: z.array(AutoBriefSourceSchema).default([]),
  confidence_score: z.number().min(0).max(1),
  missing_information: z.array(z.string()).default([]),
});

export type AutoBrief = z.infer<typeof AutoBriefSchema>;

export const LOW_CONFIDENCE_THRESHOLD = 0.55;
