import { z } from "zod";

export const ProductBriefSchema = z.object({
  product_summary: z.string(),
  target_customer: z.string(),
  primary_pain: z.string(),
  core_promise: z.string(),
  offer: z.string().default(""),
  cta: z.string().default(""),
  competitors: z.array(z.string()).default([]),
  content_pillars: z.array(z.string()).default([]),
  positioning_angles: z.array(z.string()).default([]),
  production_constraints: z
    .object({
      can_make_carousels: z.boolean().default(true),
      can_make_founder_videos: z.boolean().default(false),
      can_use_product_screenshots: z.boolean().default(true),
      can_use_ai_images: z.boolean().default(true),
      preferred_platforms: z.array(z.string()).default([]),
    })
    .default({
      can_make_carousels: true,
      can_make_founder_videos: false,
      can_use_product_screenshots: true,
      can_use_ai_images: true,
      preferred_platforms: [],
    }),
  brand_voice: z.string().default(""),
});

export type ProductBrief = z.infer<typeof ProductBriefSchema>;
