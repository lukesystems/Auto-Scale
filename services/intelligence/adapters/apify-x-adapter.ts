import type { SearchAdapter, SearchResult } from "../types";
import { filterSafeResultUrls } from "./guard-url";

const APIFY_API_TOKEN = process.env.APIFY_API_TOKEN?.trim() || null;
/** api-ninja/x-twitter-advanced-search. Actor IDs use `~` not `/` in the Apify REST API. */
const APIFY_X_ACTOR_ID = process.env.APIFY_X_ACTOR_ID?.trim() || "api-ninja~x-twitter-advanced-search";
const APIFY_API_URL = "https://api.apify.com/v2";

/**
 * Real response shape from this actor, confirmed against a live call — this
 * does NOT match the field names implied by the actor's store-page docs
 * (no `author` object, no `likeCount`/`retweetCount`/`viewCount`; engagement
 * counts and user info are flat/differently-named top-level fields).
 */
interface ApifyTweetItem {
  url?: string;
  text?: string;
  created_at?: string;
  favorites?: number;
  retweets?: number;
  replies?: number;
  // The API returns this as a numeric string (e.g. "683"), unlike the other
  // engagement counts which are real numbers — confirmed via live response.
  views?: number | string | null;
  user_info?: {
    screen_name?: string;
    verified?: boolean;
  };
}

/** `views` comes back as a numeric string from this actor; everything else is a real number. */
function toNumber(value: number | string | null | undefined): number | null {
  if (value === null || value === undefined) return null;
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : null;
}

function toSearchResult(item: ApifyTweetItem): SearchResult | null {
  if (!item.url) return null;

  return {
    url: item.url,
    title: item.text?.slice(0, 120) ?? null,
    snippet: item.text ?? null,
    publishedAt: item.created_at ?? null,
    accountHandle: item.user_info?.screen_name ?? null,
    accountType: item.user_info?.verified ? "official" : "unknown",
    engagement: {
      likes: toNumber(item.favorites),
      reposts: toNumber(item.retweets),
      replies: toNumber(item.replies),
      views: toNumber(item.views),
    },
  };
}

/**
 * Strips search-engine-style `site:x.com` filters — Apify's actor takes
 * native X search syntax, not Google operators. Quote marks are preserved:
 * X's native search supports `"exact phrase"` matching, and stripping them
 * degrades a precise query into loose any-word-anywhere matching.
 */
export function toNativeXQuery(query: string): string {
  return query.replace(/site:(x\.com|twitter\.com)/gi, "").trim();
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
          // Confirmed against the actor's live OpenAPI schema — the input
          // field is `query` (a single string with native X search-operator
          // support), NOT `searchTerms`. Sending the wrong field name is
          // silently ignored (no validation error) and the actor falls back
          // to an unfiltered firehose, which is what was happening before
          // this was caught: results were unrelated to the query entirely.
          query: toNativeXQuery(query),
          numberOfTweets,
          // "Top" returned zero results in live testing for several queries —
          // its ranking/filtering behavior is undocumented and unreliable.
          // "Latest" reliably returns results; real signal is separated out
          // by our own engagement scoring (score-candidate.ts) afterward.
          search_type: "Latest",
          // Confirmed field name (schema: none/low/medium/high/viral).
          // "low" keeps clear noise out without being so strict it returns
          // nothing for less-viral niche queries.
          engagementLevel: "low",
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
