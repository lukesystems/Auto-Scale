import { getAvailableSearchAdapter, searchAdapters } from "../adapters";
import type { SearchAdapterName, SearchResult } from "../types";

export interface SearchRunResult {
  adapter: string;
  results: SearchResult[];
}

const PREFERRED_ORDER: SearchAdapterName[] = ["firecrawl"];

/**
 * Run a single query through the configured search adapter.
 * Shared by single-pass discovery and the agentic deep-discovery loop.
 */
export async function searchWithFallback(
  query: string,
  limit: number
): Promise<SearchRunResult | null> {
  for (const name of PREFERRED_ORDER) {
    const adapter = searchAdapters.find((item) => item.name === name);
    if (!adapter?.isAvailable()) continue;

    try {
      const results = await adapter.search(query, { limit });
      if (results.length) return { adapter: adapter.name, results };
    } catch {
      // Try the next adapter in the chain.
    }
  }

  const fallback = await getAvailableSearchAdapter("firecrawl");
  if (!fallback) return null;

  try {
    const results = await fallback.search(query, { limit });
    return results.length ? { adapter: fallback.name, results } : null;
  } catch {
    return null;
  }
}
