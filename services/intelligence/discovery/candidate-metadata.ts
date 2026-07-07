import type { Json } from "@/lib/supabase/types";
import type { EnrichedCandidate } from "./enrich-candidate";
import type { CandidateQualityScore } from "./score-candidate";

export function buildCandidateSaveMetadata(
  candidate: EnrichedCandidate,
  quality?: CandidateQualityScore,
  extras?: Record<string, unknown>
): Json {
  const deepEnrichment = candidate.deepEnrichment;

  return {
    account_handle: candidate.accountHandle,
    account_type: candidate.accountType ?? null,
    engagement: candidate.engagement ?? null,
    posted_at: candidate.postedAt ?? null,
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
            engagement_signal: quality.engagementSignal,
            strategic_value: quality.strategicValue,
            confidence: quality.confidence,
            reasons: quality.reasons,
          },
        }
      : {}),
    ...(deepEnrichment
      ? {
          deep_enrichment: {
            status: deepEnrichment.status,
            crawled_at: deepEnrichment.crawledAt,
            pages_crawled: deepEnrichment.pages.length,
            pages_successful: deepEnrichment.pages.filter((p) => p.status === "success").length,
            consolidated: deepEnrichment.consolidated,
            pages: deepEnrichment.pages.map((p) => ({
              url: p.url,
              page_type: p.pageType,
              status: p.status,
              title: p.title,
              extracted: p.extracted,
            })),
          },
        }
      : {}),
    ...extras,
  } as Json;
}
