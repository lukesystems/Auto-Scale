export { planDiscovery, buildFallbackDiscoveryPlan } from "./plan-discovery";
export { runDiscovery } from "./run-discovery";
export type { RunDiscoveryInput, RunDiscoveryResult } from "./run-discovery";
export { loadDiscoveryContext, formatDiscoveryContextForPrompt } from "./load-context";
export type { DiscoveryContext } from "./load-context";
export {
  canonicalizeUrl,
  dedupeCandidates,
  normalizeSearchResults,
  inferSourceType,
} from "./dedupe-candidates";
export type { NormalizedCandidate } from "./dedupe-candidates";
export { enrichCandidate, enrichCandidates } from "./enrich-candidate";
export type { EnrichedCandidate, CandidateEnrichStatus } from "./enrich-candidate";
export {
  deepEnrichSource,
  deepEnrichCandidate,
  shouldDeepEnrich,
  discoverCompetitorPages,
} from "../enrichment/deep-enrich-source";
export type {
  DeepEnrichmentResult,
  DeepEnrichStatus,
  CompetitorPageEnrichment,
  CompetitorIntelligence,
  CompetitorPageType,
} from "../enrichment/deep-enrich-source";
export { searchWithCoverage, mergeSearchHits, normalizeCoverageResults } from "./search-coverage";
export type { MergedSearchHit, SearchCoverageRun } from "./search-coverage";
export {
  buildScoringContextFromDiscovery,
  scoreCandidate,
  scoreCandidates,
} from "./score-candidate";
export type { BriefScoringContext, CandidateQualityScore } from "./score-candidate";
export { buildCandidateSaveMetadata } from "./candidate-metadata";
export {
  DiscoveryPlanSchema,
  DiscoveryQuerySchema,
  DiscoveryIntentSchema,
} from "./schema";
export type { DiscoveryPlan, DiscoveryQuery, DiscoveryIntent } from "./schema";
