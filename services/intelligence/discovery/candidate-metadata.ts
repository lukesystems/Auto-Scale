import type { Json } from "@/lib/supabase/types";
import type { EnrichedCandidate } from "./enrich-candidate";
import type { CandidateQualityScore } from "./score-candidate";

export function buildCandidateSaveMetadata(
  candidate: EnrichedCandidate,
  quality?: CandidateQualityScore,
  extras?: Record<string, unknown>
): Json {
  return {
    account_handle: candidate.accountHandle,
    enrich_status: candidate.enrichStatus,
    enrich_error: candidate.enrichError,
    fetch_metadata: candidate.fetchMetadata,
    ...(quality
      ? {
          quality: {
            competitor_likelihood: quality.competitorLikelihood,
            audience_relevance: quality.audienceRelevance,
            evidence_richness: quality.evidenceRichness,
            platform_value: quality.platformValue,
            strategic_value: quality.strategicValue,
            confidence: quality.confidence,
            reasons: quality.reasons,
          },
        }
      : {}),
    ...extras,
  } as Json;
}
