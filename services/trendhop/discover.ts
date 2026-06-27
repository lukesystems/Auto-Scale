import "server-only";
import { exaSearchAdapter } from "@/services/intelligence/adapters/exa-search-adapter";
import type {
  DiscoveredTrendCandidate,
  TrendHopPlatform,
} from "./schema";

interface DiscoverInput {
  niche: string | null;
  productCategory?: string | null;
  limitPerPlatform?: number;
}

const PLATFORM_QUERIES: Array<{
  platform: TrendHopPlatform;
  query: (niche: string) => string;
}> = [
  {
    platform: "tiktok",
    query: (niche) => `trending TikTok videos this week ${niche} ("10k followers" OR "50k followers") site:tiktok.com`,
  },
  {
    platform: "youtube_shorts",
    query: (niche) => `viral YouTube Shorts trending ${niche} creator site:youtube.com/shorts`,
  },
  {
    platform: "instagram_reels",
    query: (niche) => `trending Instagram Reels ${niche} ("10k followers" OR "100k followers") site:instagram.com/reel`,
  },
  {
    platform: "twitter",
    query: (niche) => `viral X tweets trend this week ${niche} site:x.com`,
  },
];

const TREND_TRACKER_QUERIES = (niche: string) => [
  `top TikTok trends this week ${niche} ("50k followers" OR "100k followers")`,
  `viral short-form video format ${niche} micro creator`,
];

/**
 * Pull a deduped list of trending content candidates from the public web via
 * the Exa adapter. Falls back to an empty list when EXA is not configured.
 *
 * This is intentionally simple. Adapter slots for TokAudit / Tokboard / Exolyt
 * can be added by exporting another adapter that returns the same shape.
 */
export async function discoverTrendCandidates(
  input: DiscoverInput
): Promise<DiscoveredTrendCandidate[]> {
  if (!exaSearchAdapter.isAvailable()) return [];
  const niche = (input.niche || input.productCategory || "growth marketing").trim();
  const limit = input.limitPerPlatform ?? 6;

  const platformResults = await Promise.all(
    PLATFORM_QUERIES.map(async ({ platform, query }) => {
      try {
        const results = await exaSearchAdapter.search(query(niche), { limit });
        return results.map(
          (r): DiscoveredTrendCandidate => ({
            platform,
            url: r.url,
            title: r.title ?? null,
            snippet: r.snippet ?? null,
            publishedAt: r.publishedAt ?? null,
          })
        );
      } catch (err) {
        console.warn("[trendhop:discover] platform query failed", platform, err);
        return [];
      }
    })
  );

  const trackerResults = await Promise.all(
    TREND_TRACKER_QUERIES(niche).map(async (q) => {
      try {
        const results = await exaSearchAdapter.search(q, { limit: 6 });
        return results.map(
          (r): DiscoveredTrendCandidate => ({
            platform: "other",
            url: r.url,
            title: r.title ?? null,
            snippet: r.snippet ?? null,
            publishedAt: r.publishedAt ?? null,
          })
        );
      } catch {
        return [];
      }
    })
  );

  const seen = new Set<string>();
  const all = [...platformResults.flat(), ...trackerResults.flat()];
  return all.filter((item) => {
    if (seen.has(item.url)) return false;
    seen.add(item.url);
    return true;
  });
}
