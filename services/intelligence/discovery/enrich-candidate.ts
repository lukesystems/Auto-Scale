import { safeFetchUrl } from "@/services/trendwatch/ingestion";
import type { NormalizedCandidate } from "./dedupe-candidates";

export type CandidateEnrichStatus = "pending" | "enriched" | "failed" | "skipped";

export interface EnrichedCandidate extends NormalizedCandidate {
  enrichStatus: CandidateEnrichStatus;
  enrichError: string | null;
  enrichedTitle: string | null;
  enrichedSnippet: string | null;
  fetchMetadata: Record<string, unknown>;
}

export async function enrichCandidate(candidate: NormalizedCandidate): Promise<EnrichedCandidate> {
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
      };
    }

    return {
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
    };
  } catch (error) {
    return {
      ...candidate,
      enrichStatus: "failed",
      enrichError: error instanceof Error ? error.message : "Enrichment failed.",
      enrichedTitle: candidate.title,
      enrichedSnippet: candidate.snippet,
      fetchMetadata: { fetch_status: "failed" },
    };
  }
}

export async function enrichCandidates(
  candidates: NormalizedCandidate[],
  concurrency = 3
): Promise<EnrichedCandidate[]> {
  const results: EnrichedCandidate[] = new Array(candidates.length);
  let index = 0;

  async function worker() {
    while (index < candidates.length) {
      const current = index;
      index += 1;
      results[current] = await enrichCandidate(candidates[current]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, candidates.length) }, () => worker())
  );

  return results;
}
