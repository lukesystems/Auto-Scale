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
export {
  DiscoveryPlanSchema,
  DiscoveryQuerySchema,
  DiscoveryIntentSchema,
} from "./schema";
export type { DiscoveryPlan, DiscoveryQuery, DiscoveryIntent } from "./schema";
