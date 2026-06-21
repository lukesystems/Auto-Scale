import { searchAdapters } from "../adapters";
import type { SearchAdapterName, SearchResult } from "../types";
import { canonicalizeUrl, extractAccountHandle, inferSourceType } from "./dedupe-candidates";
import { detectPlatform } from "@/services/trendwatch/ingestion";
import type { DiscoveryIntent } from "./schema";
import type { NormalizedCandidate } from "./dedupe-candidates";

const ADAPTER_ORDER: SearchAdapterName[] = ["exa", "brave", "firecrawl"];

/** Per-URL hit after merging results from one or more search adapters. */
export interface MergedSearchHit extends SearchResult {
  adapters: string[];
  /** Higher when found by more adapters and/or ranked higher in result lists. */
  coverageScore: number;
}

export interface SearchCoverageRun {
  results: MergedSearchHit[];
  adaptersUsed: string[];
  adapterErrors: Partial<Record<SearchAdapterName, string>>;
}

interface AdapterBatch {
  adapter: string;
  results: SearchResult[];
}

/**
 * Merge search hits from multiple adapters. Same canonical URL is collapsed;
 * coverage score rewards multi-adapter agreement and better result positions.
 */
export function mergeSearchHits(batches: AdapterBatch[], limit: number): MergedSearchHit[] {
  const hitsByUrl = new Map<string, MergedSearchHit>();

  for (const batch of batches) {
    batch.results.forEach((result, index) => {
      const key = canonicalizeUrl(result.url);
      const rankScore = Math.max(0.1, 1 - index * 0.05);
      const existing = hitsByUrl.get(key);

      if (!existing) {
        hitsByUrl.set(key, {
          ...result,
          adapters: [batch.adapter],
          coverageScore: rankScore,
        });
        return;
      }

      if (!existing.adapters.includes(batch.adapter)) {
        existing.adapters.push(batch.adapter);
        existing.coverageScore += 0.12;
      }
      existing.coverageScore = Math.max(existing.coverageScore, rankScore);

      if ((result.snippet?.length ?? 0) > (existing.snippet?.length ?? 0)) {
        existing.snippet = result.snippet;
      }
      if ((result.title?.length ?? 0) > (existing.title?.length ?? 0)) {
        existing.title = result.title;
      }
    });
  }

  return [...hitsByUrl.values()]
    .sort((a, b) => b.coverageScore - a.coverageScore)
    .slice(0, limit);
}

/**
 * Run all available search adapters for a query, merge results, and return the
 * strongest candidates. Adapter failures are isolated — one bad adapter does
 * not fail the whole search.
 */
export async function searchWithCoverage(
  query: string,
  limit: number
): Promise<SearchCoverageRun> {
  const adaptersUsed: string[] = [];
  const adapterErrors: Partial<Record<SearchAdapterName, string>> = {};
  const batches: AdapterBatch[] = [];

  const runs = await Promise.allSettled(
    ADAPTER_ORDER.map(async (name) => {
      const adapter = searchAdapters.find((item) => item.name === name);
      if (!adapter?.isAvailable()) return { name, results: [] as SearchResult[], skipped: true };

      try {
        const results = await adapter.search(query, { limit });
        return { name, results, skipped: false };
      } catch (error) {
        const message = error instanceof Error ? error.message : "Search failed.";
        adapterErrors[name] = message;
        return { name, results: [] as SearchResult[], skipped: false };
      }
    })
  );

  for (const run of runs) {
    if (run.status === "rejected") continue;
    const { name, results, skipped } = run.value;
    if (skipped || !results.length) continue;
    adaptersUsed.push(name);
    batches.push({ adapter: name, results });
  }

  return {
    results: mergeSearchHits(batches, limit),
    adaptersUsed,
    adapterErrors,
  };
}

/** Turn merged coverage hits into normalized discovery candidates. */
export function normalizeCoverageResults(input: {
  hits: MergedSearchHit[];
  query: string;
  reason: string;
  intent: DiscoveryIntent;
}): NormalizedCandidate[] {
  return input.hits.map((hit) => {
    const platform = detectPlatform(hit.url);
    const canonicalUrl = canonicalizeUrl(hit.url);
    return {
      url: hit.url,
      canonicalUrl,
      title: hit.title,
      snippet: hit.snippet,
      platform,
      sourceType: inferSourceType(hit.url, input.intent),
      adapter: hit.adapters.join("+") || "unknown",
      discoveryQuery: input.query,
      discoveryReason: input.reason,
      relevanceScore: hit.coverageScore,
      accountHandle: extractAccountHandle(hit.url, platform),
    };
  });
}
