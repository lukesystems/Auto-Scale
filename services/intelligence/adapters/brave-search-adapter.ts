import type { SearchAdapter, SearchResult } from "../types";
import { filterSafeResultUrls } from "./guard-url";

const BRAVE_SEARCH_API_KEY = process.env.BRAVE_SEARCH_API_KEY?.trim() || null;

export const braveSearchAdapter: SearchAdapter = {
  name: "brave",

  isAvailable() {
    return Boolean(BRAVE_SEARCH_API_KEY);
  },

  async search(query: string, options?: { limit?: number }): Promise<SearchResult[]> {
    if (!BRAVE_SEARCH_API_KEY) {
      throw new Error("BRAVE_SEARCH_API_KEY is not configured.");
    }

    const params = new URLSearchParams({
      q: query,
      count: String(options?.limit ?? 10),
    });

    const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params}`, {
      headers: {
        Accept: "application/json",
        "X-Subscription-Token": BRAVE_SEARCH_API_KEY,
      },
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Brave search failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      web?: { results?: Array<{ url?: string; title?: string; description?: string }> };
    };

    return filterSafeResultUrls(
      (payload.web?.results ?? [])
        .filter((item) => item.url)
        .map((item) => ({
          url: item.url!,
          title: item.title ?? null,
          snippet: item.description ?? null,
          publishedAt: null,
        }))
    );
  },
};
