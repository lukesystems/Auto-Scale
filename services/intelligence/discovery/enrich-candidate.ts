import { safeFetchUrl } from "@/services/trendwatch/ingestion";
import type { NormalizedCandidate } from "./dedupe-candidates";
import {
  deepEnrichCandidate,
  shouldDeepEnrich,
  type DeepEnrichmentResult,
} from "../enrichment/deep-enrich-source";

export type CandidateEnrichStatus = "pending" | "enriched" | "failed" | "skipped" | "deep_enriched";

/** Max candidates that receive multi-page deep enrichment per discovery run (×4 pages each). */
export const MAX_DEEP_ENRICH_PER_RUN = 8;

export function pickDeepEnrichCandidateIndices(
  candidates: NormalizedCandidate[],
  max = MAX_DEEP_ENRICH_PER_RUN
): Set<number> {
  const indices = new Set<number>();
  for (let i = 0; i < candidates.length && indices.size < max; i++) {
    const candidate = candidates[i];
    if (shouldDeepEnrich(candidate.sourceType, candidate.relevanceScore)) {
      indices.add(i);
    }
  }
  return indices;
}

export interface EnrichedCandidate extends NormalizedCandidate {
  enrichStatus: CandidateEnrichStatus;
  enrichError: string | null;
  enrichedTitle: string | null;
  enrichedSnippet: string | null;
  fetchMetadata: Record<string, unknown>;
  deepEnrichment?: DeepEnrichmentResult | null;
}

export async function enrichCandidate(
  candidate: NormalizedCandidate,
  options?: { enableDeepEnrich?: boolean }
): Promise<EnrichedCandidate> {
  const enableDeep = options?.enableDeepEnrich ?? true;

  try {
    const fetched = await safeFetchUrl(candidate.url);

    if (fetched.status !== "success") {
      return {
        ...candidate,
        enrichStatus: "failed",
        enrichError: fetched.error ?? "Fetch failed.",
        enrichedTitle: candidate.title,
        enrichedSnippet: candidate.snippet,
        fetchMetadata: { fetch_status: fetched.status, error: fetched.error },
        deepEnrichment: null,
      };
    }

    const baseResult: EnrichedCandidate = {
      ...candidate,
      enrichStatus: "enriched",
      enrichError: null,
      enrichedTitle: fetched.title ?? candidate.title,
      enrichedSnippet: fetched.textSnippet ?? candidate.snippet,
      fetchMetadata: {
        fetch_status: fetched.status,
        final_url: fetched.finalUrl,
        platform: fetched.platform,
      },
      deepEnrichment: null,
    };

    if (enableDeep && shouldDeepEnrich(candidate.sourceType, candidate.relevanceScore)) {
      const deep = await deepEnrichCandidate({
        url: fetched.finalUrl || candidate.url,
        sourceType: candidate.sourceType,
        relevanceScore: candidate.relevanceScore,
      });

      if (deep) {
        baseResult.deepEnrichment = deep;
        if (deep.status === "enriched" || deep.status === "enriching") {
          baseResult.enrichStatus = "deep_enriched";
          baseResult.fetchMetadata.deep_enriched = true;
          baseResult.fetchMetadata.deep_pages_crawled = deep.pages.length;
          baseResult.fetchMetadata.deep_pages_successful = deep.pages.filter(
            (p) => p.status === "success"
          ).length;
        }
      }
    }

    return baseResult;
  } catch (error) {
    return {
      ...candidate,
      enrichStatus: "failed",
      enrichError: error instanceof Error ? error.message : "Enrichment failed.",
      enrichedTitle: candidate.title,
      enrichedSnippet: candidate.snippet,
      fetchMetadata: { fetch_status: "failed" },
      deepEnrichment: null,
    };
  }
}

export async function enrichCandidates(
  candidates: NormalizedCandidate[],
  options?: { concurrency?: number; enableDeepEnrich?: boolean; maxDeepEnrich?: number }
): Promise<EnrichedCandidate[]> {
  const concurrency = options?.concurrency ?? 3;
  const deepEnrichEnabled = options?.enableDeepEnrich !== false;
  const deepEnrichIndices = deepEnrichEnabled
    ? pickDeepEnrichCandidateIndices(candidates, options?.maxDeepEnrich)
    : new Set<number>();

  const results: EnrichedCandidate[] = new Array(candidates.length);
  let index = 0;

  async function worker() {
    while (index < candidates.length) {
      const current = index;
      index += 1;
      results[current] = await enrichCandidate(candidates[current], {
        enableDeepEnrich: deepEnrichIndices.has(current),
      });
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker())
  );

  return results;
}
