import { z } from "zod";

export const TrendHopPlatformSchema = z.enum([
  "tiktok",
  "youtube_shorts",
  "instagram_reels",
  "twitter",
  "linkedin",
  "reddit",
  "other",
]);

export const TrendHopReferenceSchema = z.object({
  url: z.string().url(),
  title: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
});

export const TrendHopItemSchema = z.object({
  platform: TrendHopPlatformSchema,
  trend_name: z.string().min(2),
  why_hot: z.string().min(8),
  references: z.array(TrendHopReferenceSchema).min(1).max(8),
  product_angle: z.string().min(8),
  suggested_hook: z.string().min(4),
  suggested_concept: z.string().min(8),
  recency_score: z.number().min(0).max(1),
  confidence: z.number().min(0).max(1),
});

export const TrendHopListSchema = z.object({
  hops: z.array(TrendHopItemSchema).min(0).max(12),
});

export type TrendHopPlatform = z.infer<typeof TrendHopPlatformSchema>;
export type TrendHopReference = z.infer<typeof TrendHopReferenceSchema>;
export type TrendHopItem = z.infer<typeof TrendHopItemSchema>;
export type TrendHopList = z.infer<typeof TrendHopListSchema>;

export interface DiscoveredTrendCandidate {
  platform: TrendHopPlatform;
  url: string;
  title: string | null;
  snippet: string | null;
  publishedAt: string | null;
}
