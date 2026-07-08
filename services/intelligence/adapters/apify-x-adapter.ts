import type { SearchAdapter, SearchResult } from "../types";
import { filterSafeResultUrls } from "./guard-url";

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN?.trim() || null;
/** api-ninja/x-twitter-advanced-search — chosen for built-in engagement-tier filtering and view counts (see docs/SCRAPING_ENGINE.md). */
const APIFY_X_ACTOR_ID = process.env.APIFY_X_ACTOR_ID?.trim() || "api-ninja~x-twitter-advanced-search";
const APIFY_API_URL = "https://api.apify.com/v2";

interface ApifyTweetItem {
  url?: string;
  text?: string;
  createdAt?: string;
  author?: {
    userName?: string;
    isVerified?: boolean;
    isBlueVerified?: boolean;
  };
  likeCount?: number;
  retweetCount?: number;
  replyCount?: number;
  viewCount?: number;
}

function inferAccountType(author: ApifyTweetItem["author"]): SearchResult["accountType"] {
  if (!author) return "unknown";
  if (author.isVerified) return "official";
  if (author.isBlueVerified) return "creator";
  return "unknown";
}

function toSearchResult(item: ApifyTweetItem): SearchResult | null {
  if (!item.url) return null;

  return {
    url: item.url,
    title: item.text?.slice(0, 120) ?? null,
    snippet: item.text ?? null,
    publishedAt: item.createdAt ?? null,
    accountHandle: item.author?.userName ?? null,
    accountType: inferAccountType(item.author),
    engagement: {
      likes: item.likeCount ?? null,
      reposts: item.retweetCount ?? null,
      replies: item.replyCount ?? null,
      views: item.viewCount ?? null,
    },
  };
}

/** Strips search-engine-style `site:x.com` filters — Apify's actor takes native X search syntax, not Google operators. */
export function toNativeXQuery(query: string): string {
  return query
    .replace(/site:(x\.com|twitter\.com)/gi, "")
    .replace(/["']/g, "")
    .trim();
}

export const apifyXSearchAdapter: SearchAdapter = {
  name: "apify-x",

  isAvailable() {
    return Boolean(APIFY_API_TOKEN);
  },

  async search(query: string, options?: { limit?: number }): Promise<SearchResult[]> {
    if (!APIFY_API_TOKEN) {
      throw new Error("APIFY_API_TOKEN is not configured.");
    }

    const numberOfTweets = Math.max(20, options?.limit ?? 20);

    const response = await fetch(
      `${APIFY_API_URL}/acts/${APIFY_X_ACTOR_ID}/run-sync-get-dataset-items?token=${APIFY_API_TOKEN}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          searchTerms: [toNativeXQuery(query)],
          numberOfTweets,
          search_type: "Top",
          engagementPreset: "medium",
        }),
        signal: AbortSignal.timeout(60_000),
      }
    );

    if (!response.ok) {
      throw new Error(`Apify X actor run failed: HTTP ${response.status}`);
    }

    const items = (await response.json()) as ApifyTweetItem[];
    const results = items.map(toSearchResult).filter((item): item is SearchResult => item !== null);

    return filterSafeResultUrls(results);
  },
};
