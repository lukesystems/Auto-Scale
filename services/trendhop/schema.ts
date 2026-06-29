import { z } from "zod";
import {
  confidenceScoreField,
  defaultStringField,
  enumField,
  looseUrlField,
} from "@/lib/zod-coerce";

export const TRENDHOP_PLATFORMS = [
  "tiktok",
  "youtube_shorts",
  "instagram_reels",
  "twitter",
  "linkedin",
  "reddit",
  "other",
] as const;

const TRENDHOP_PLATFORM_ALIASES: Record<string, (typeof TRENDHOP_PLATFORMS)[number]> = {
  youtube: "youtube_shorts",
  youtube_short: "youtube_shorts",
  shorts: "youtube_shorts",
  instagram: "instagram_reels",
  reels: "instagram_reels",
  ig: "instagram_reels",
  x: "twitter",
};

export const TrendHopPlatformSchema = enumField(
  TRENDHOP_PLATFORMS,
  "tiktok",
  TRENDHOP_PLATFORM_ALIASES
);

export const TrendHopReferenceSchema = z.object({
  url: looseUrlField("https://example.com/trend"),
  title: z.string().nullable().optional(),
  snippet: z.string().nullable().optional(),
});

export const TrendHopItemSchema = z.object({
  platform: TrendHopPlatformSchema,
  trend_name: defaultStringField("Trending topic"),
  why_hot: defaultStringField("Trend is gaining traction in this niche."),
  references: z.preprocess(
    (value) => {
      if (!Array.isArray(value) || value.length === 0) {
        return [{ url: "https://example.com/trend" }];
      }
      return value;
    },
    z.array(TrendHopReferenceSchema).min(1).max(8)
  ),
  product_angle: defaultStringField("Product fits this trend organically for the target audience."),
  suggested_hook: defaultStringField("Quick hook for this trend"),
  suggested_concept: defaultStringField("Short video concept hopping on this trend."),
  recency_score: confidenceScoreField(0.5),
  confidence: confidenceScoreField(0.5),
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
