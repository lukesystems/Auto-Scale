import type { SearchAdapter, SearchResult } from "../types";
import { filterSafeResultUrls } from "./guard-url";

const EXA_API_KEY = process.env.EXA_API_KEY?.trim() || null;

export const exaSearchAdapter: SearchAdapter = {
  name: "exa",

  isAvailable() {
    return Boolean(EXA_API_KEY);
  },

  async search(query: string, options?: { limit?: number }): Promise<SearchResult[]> {
    if (!EXA_API_KEY) {
      throw new Error("EXA_API_KEY is not configured.");
    }

    const response = await fetch("https://api.exa.ai/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": EXA_API_KEY,
      },
      body: JSON.stringify({
        query,
        numResults: options?.limit ?? 10,
        type: "auto",
        contents: { text: { maxCharacters: 1000 } },
      }),
      signal: AbortSignal.timeout(20_000),
    });

    if (!response.ok) {
      throw new Error(`Exa search failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      results?: Array<{ url?: string; title?: string; text?: string; publishedDate?: string }>;
    };

    return filterSafeResultUrls(
      (payload.results ?? [])
        .filter((item) => item.url)
        .map((item) => ({
          url: item.url!,
          title: item.title ?? null,
          snippet: item.text?.slice(0, 1000) ?? null,
          publishedAt: item.publishedDate ?? null,
        }))
    );
  },
};
