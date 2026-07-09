import type { Json } from "@/lib/supabase/types";
import { loadDiscoveryContext } from "../discovery/load-context";
import { loadExistingCandidateUrls } from "../discovery/run-discovery";
import {
  dedupeCandidates,
  type NormalizedCandidate,
} from "../discovery/dedupe-candidates";
import { enrichCandidates, type EnrichedCandidate } from "../discovery/enrich-candidate";
import { normalizeCoverageResults, searchWithCoverage } from "../discovery/search-coverage";
import { mapWithConcurrency } from "../util/map-with-concurrency";
import {
  buildScoringContextFromDiscovery,
  scoreCandidates,
} from "../discovery/score-candidate";
import { buildCandidateSaveMetadata } from "../discovery/candidate-metadata";
import { saveDiscoveryRun } from "../memory/save-discovery-run";
import { saveSourceCandidates } from "../memory/save-source-candidates";
import type { DiscoveryQuery } from "../discovery/schema";
import { reasonNextStep } from "./reason-next-step";
import { synthesizeFindings } from "./synthesize-findings";
import { promoteSynthesisCompetitors } from "../memory/promote-synthesis-competitors";
import { linkCandidatesToCompetitors } from "../memory/link-candidates-to-competitors";
import { refreshBriefCompetitorsFromSynthesis } from "../memory/refresh-brief-competitors";
import type { MarketSynthesis } from "./schema";

const MAX_ROUNDS = 4;
const MAX_RESULTS_PER_QUERY = 10;
const MAX_TOTAL_CANDIDATES = 60;
const MAX_DIGEST_LINES = 40;
/** Cap native X calls per run — Apify is pay-per-result, this is a safety net on top of the reasoner's own judgment. */
const MAX_FORCED_X_QUERIES_PER_RUN = 4;

/**
 * The reasoner is instructed to tag platform_hint: "x" on creator/distribution/
 * shadow_account queries, but two things make that unreliable in practice:
 * the model doesn't always remember the tag, AND it doesn't reliably use the
 * intent labels we'd want to gate on either (a query that reads exactly like
 * the X example in the prompt — e.g. "Jira alternative OR switched" — has
 * come back tagged "alternative" or "pain" instead of "distribution").
 * A generic-web-search query with no platform hint returns text snippets
 * with zero engagement data, which is the single biggest driver of
 * "generic-feeling" strategy output. Rather than trust either the tag or the
 * intent label, force the first few platform-agnostic queries per round onto
 * X directly — any query that isn't already earmarked for another platform is
 * a reasonable X candidate (founder/creator sentiment shows up on X across
 * nearly every intent: competitor, pain, alternative, comparison, etc).
 */
function applyXRoutingFallback(queries: DiscoveryQuery[], budgetRemaining: number): DiscoveryQuery[] {
  if (budgetRemaining <= 0) return queries;
  const platformNamePattern = /tiktok|instagram|reddit|youtube|linkedin|g2\.com|capterra|site:/i;
  let forced = 0;

  return queries.map((query) => {
    if (query.platform_hint || forced >= budgetRemaining) return query;
    if (query.intent === "community" || query.intent === "platform") return query;
    if (platformNamePattern.test(query.query)) return query;
    forced += 1;
    return { ...query, platform_hint: "x" };
  });
}

export interface RunDeepDiscoveryInput {
  projectId: string;
  maxRounds?: number;
}

export interface DeepDiscoveryRoundTrace {
  round: number;
  thought: string;
  hypotheses: string[];
  queries: string[];
  newCandidates: number;
  shouldContinue: boolean;
  stopReason: string | null;
  provider: string;
  model: string;
  usedFallback: boolean;
}

export interface RunDeepDiscoveryResult {
  ok: boolean;
  runId: string | null;
  rounds: number;
  candidatesFound: number;
  candidatesSaved: number;
  adaptersUsed: string[];
  hypotheses: string[];
  trace: DeepDiscoveryRoundTrace[];
  synthesis: MarketSynthesis | null;
  usedFallbackSynthesis: boolean;
  competitorsPromoted: number;
  competitorAccountsPromoted: number;
  candidatesLinked: number;
  error: string | null;
}

export async function runDeepDiscovery(
  input: RunDeepDiscoveryInput
): Promise<RunDeepDiscoveryResult> {
  const maxRounds = clampRounds(input.maxRounds);
  const empty: Omit<RunDeepDiscoveryResult, "error" | "ok" | "runId"> = {
    rounds: 0,
    candidatesFound: 0,
    candidatesSaved: 0,
    adaptersUsed: [],
    hypotheses: [],
    trace: [],
    synthesis: null,
    usedFallbackSynthesis: false,
    competitorsPromoted: 0,
    competitorAccountsPromoted: 0,
    candidatesLinked: 0,
  };

  const context = await loadDiscoveryContext(input.projectId);
  if (!context) {
    return {
      ...empty,
      ok: false,
      runId: null,
      error: "Product brief required before discovery. Complete AutoBrief first.",
    };
  }

  let runId: string | null = null;
  try {
    runId = await saveDiscoveryRun({
      projectId: input.projectId,
      status: "running",
      queries: [],
      primaryAdapter: "firecrawl",
    });
  } catch (error) {
    return {
      ...empty,
      ok: false,
      runId: null,
      error: error instanceof Error ? error.message : "Failed to start deep discovery run.",
    };
  }

  const seenUrls = await loadExistingCandidateUrls(input.projectId);
  const gathered: NormalizedCandidate[] = [];
  const ranQueries: string[] = [];
  const ranQueryKeys = new Set<string>();
  const allQueryObjects: DiscoveryQuery[] = [];
  const adaptersUsed = new Set<string>();
  const hypotheses: string[] = [];
  const trace: DeepDiscoveryRoundTrace[] = [];
  const intentsByQuery = new Map<string, DiscoveryQuery["intent"]>();

  let roundsRun = 0;
  let forcedXBudget = MAX_FORCED_X_QUERIES_PER_RUN;

  for (let round = 1; round <= maxRounds; round++) {
    if (gathered.length >= MAX_TOTAL_CANDIDATES) break;

    const reasoned = await reasonNextStep({
      context,
      evidenceDigest: buildEvidenceDigest(gathered),
      round,
      maxRounds,
      alreadyRunQueries: ranQueries,
    });

    roundsRun = round;
    const action = reasoned.action;
    for (const h of action.hypotheses) {
      if (h && !hypotheses.includes(h)) hypotheses.push(h);
    }

    const routedQueries = applyXRoutingFallback(action.next_queries, forcedXBudget);
    forcedXBudget -= routedQueries.filter(
      (q, i) => q.platform_hint === "x" && action.next_queries[i]?.platform_hint !== "x"
    ).length;

    // Dedupe/bookkeep synchronously first, then fire the actual searches in
    // parallel — the queries in a round are independent, no reason to pay
    // their network latency serially (this was ~5 sequential calls/round).
    const queriesToRun: DiscoveryQuery[] = [];
    for (const query of routedQueries) {
      const key = query.query.trim().toLowerCase();
      if (!key || ranQueryKeys.has(key)) continue;
      ranQueryKeys.add(key);
      ranQueries.push(query.query);
      allQueryObjects.push(query);
      intentsByQuery.set(query.query, query.intent);
      queriesToRun.push(query);
    }

    let roundNewCandidates = 0;
    const roundResults = await mapWithConcurrency(queriesToRun, 4, async (query) => ({
      query,
      coverage: await searchWithCoverage(query.query, MAX_RESULTS_PER_QUERY, query.platform_hint ?? null),
    }));

    for (const { query, coverage } of roundResults) {
      if (gathered.length >= MAX_TOTAL_CANDIDATES) break;
      for (const adapter of coverage.adaptersUsed) adaptersUsed.add(adapter);

      const batch = normalizeCoverageResults({
        hits: coverage.results,
        query: query.query,
        reason: query.reason,
        intent: query.intent,
      });

      for (const candidate of batch) {
        if (gathered.length >= MAX_TOTAL_CANDIDATES) break;
        if (seenUrls.has(candidate.canonicalUrl)) continue;
        seenUrls.add(candidate.canonicalUrl);
        gathered.push(candidate);
        roundNewCandidates += 1;
      }
    }

    trace.push({
      round,
      thought: action.thought,
      hypotheses: action.hypotheses,
      queries: action.next_queries.map((q) => q.query),
      newCandidates: roundNewCandidates,
      shouldContinue: action.should_continue,
      stopReason: action.stop_reason,
      provider: reasoned.provider,
      model: reasoned.model,
      usedFallback: reasoned.usedFallback,
    });

    if (!action.should_continue) break;
    if (action.next_queries.length === 0) break;
  }

  const deduped = dedupeCandidates(gathered);
  const scoringContext = buildScoringContextFromDiscovery(context);
  const scored = scoreCandidates(deduped, intentsByQuery, scoringContext);
  const qualityByUrl = new Map(
    scored.map((row) => [row.candidate.canonicalUrl, row.quality] as const)
  );
  const rankedCandidates = scored
    .map((row) => row.candidate)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const enriched: EnrichedCandidate[] = rankedCandidates.length
    ? await enrichCandidates(rankedCandidates)
    : [];

  let candidatesSaved = 0;
  if (runId && enriched.length) {
    try {
      const ids = await saveSourceCandidates(
        enriched.map((candidate) => {
          const quality = qualityByUrl.get(candidate.canonicalUrl);
          return {
            discoveryRunId: runId!,
            projectId: input.projectId,
            url: candidate.url,
            canonicalUrl: candidate.canonicalUrl,
            title: candidate.enrichedTitle ?? candidate.title,
            snippet: candidate.enrichedSnippet ?? candidate.snippet,
            sourceType: candidate.sourceType,
            platform: candidate.platform,
            adapter: candidate.adapter,
            discoveryQuery: candidate.discoveryQuery,
            discoveryReason: candidate.discoveryReason,
            relevanceScore: candidate.relevanceScore,
            enrichStatus: candidate.enrichStatus,
            accountType: candidate.accountType ?? null,
            engagement: candidate.engagement ?? null,
            postedAt: candidate.postedAt ?? null,
            metadata: buildCandidateSaveMetadata(candidate, quality),
          };
        })
      );
      candidatesSaved = ids.length;
    } catch (error) {
      await finishRun(runId, input.projectId, "failed", {
        allQueryObjects,
        adaptersUsed,
        candidatesFound: deduped.length,
        roundsRun,
        trace,
        hypotheses,
        synthesis: null,
        usedFallbackSynthesis: false,
        error: error instanceof Error ? error.message : "Failed to save candidates.",
      });
      return {
        ok: false,
        runId,
        rounds: roundsRun,
        candidatesFound: deduped.length,
        candidatesSaved: 0,
        adaptersUsed: [...adaptersUsed],
        hypotheses,
        trace,
        synthesis: null,
        usedFallbackSynthesis: false,
        competitorsPromoted: 0,
        competitorAccountsPromoted: 0,
        candidatesLinked: 0,
        error: error instanceof Error ? error.message : "Failed to save candidates.",
      };
    }
  }

  const synthesisResult = await synthesizeFindings({
    context,
    evidenceDigest: buildEnrichedDigest(enriched),
    hypotheses,
  });

  let competitorsPromoted = 0;
  let competitorAccountsPromoted = 0;
  let candidatesLinked = 0;

  if (runId && synthesisResult.synthesis.competitors.length > 0) {
    try {
      const promoted = await promoteSynthesisCompetitors({
        projectId: input.projectId,
        discoveryRunId: runId,
        synthesis: synthesisResult.synthesis,
      });
      competitorsPromoted = promoted.competitorsUpserted;
      competitorAccountsPromoted = promoted.accountsUpserted;
    } catch (error) {
      console.warn(
        "[deep-discovery] competitor promotion failed",
        error instanceof Error ? error.message : error
      );
    }

    // Phase 5C: link source_candidates to the competitors they describe so the
    // evidence graph is queryable, not just embedded in synthesis URLs.
    try {
      const linked = await linkCandidatesToCompetitors({ projectId: input.projectId });
      candidatesLinked = linked.candidatesLinked;
    } catch (error) {
      console.warn(
        "[deep-discovery] candidate linking failed",
        error instanceof Error ? error.message : error
      );
    }

    // Close the loop: push evidence-backed competitors back into the brief the
    // founder reads, replacing the original model guesses with verified entries.
    try {
      await refreshBriefCompetitorsFromSynthesis({
        projectId: input.projectId,
        synthesis: synthesisResult.synthesis,
      });
    } catch (error) {
      console.warn(
        "[deep-discovery] brief competitor refresh failed",
        error instanceof Error ? error.message : error
      );
    }
  }

  const status = candidatesSaved > 0 ? "success" : deduped.length > 0 ? "partial" : "failed";
  const error =
    candidatesSaved > 0
      ? null
      : "No new source candidates found. Try refining the brief or add sources manually.";

  if (runId) {
    await finishRun(runId, input.projectId, status, {
      allQueryObjects,
      adaptersUsed,
      candidatesFound: deduped.length,
      roundsRun,
      trace,
      hypotheses,
      synthesis: synthesisResult.synthesis,
      usedFallbackSynthesis: synthesisResult.usedFallback,
      synthesisModel: synthesisResult.model,
      synthesisProvider: synthesisResult.provider,
      competitors_promoted: competitorsPromoted,
      competitor_accounts_promoted: competitorAccountsPromoted,
      candidates_linked: candidatesLinked,
      error,
    });
  }

  return {
    ok: candidatesSaved > 0,
    runId,
    rounds: roundsRun,
    candidatesFound: deduped.length,
    candidatesSaved,
    adaptersUsed: [...adaptersUsed],
    hypotheses,
    trace,
    synthesis: synthesisResult.synthesis,
    usedFallbackSynthesis: synthesisResult.usedFallback,
    competitorsPromoted,
    competitorAccountsPromoted,
    candidatesLinked,
    error: candidatesSaved > 0 ? null : error,
  };
}

function clampRounds(value: number | undefined): number {
  if (!value || !Number.isFinite(value)) return MAX_ROUNDS;
  return Math.max(1, Math.min(MAX_ROUNDS, Math.floor(value)));
}

function buildEvidenceDigest(candidates: NormalizedCandidate[]): string {
  if (!candidates.length) return "";
  return candidates
    .slice(0, MAX_DIGEST_LINES)
    .map((c) => {
      const handle = c.accountHandle ? ` @${c.accountHandle}` : "";
      const snippet = c.snippet ? ` — ${c.snippet.slice(0, 140)}` : "";
      return `- [${c.platform}/${c.sourceType}]${handle} ${c.title ?? c.url} (${c.url})${snippet}`;
    })
    .join("\n");
}

export function buildEnrichedDigest(candidates: EnrichedCandidate[]): string {
  if (!candidates.length) return "";

  const lines: string[] = [];

  for (const c of candidates.slice(0, MAX_DIGEST_LINES)) {
    const handle = c.accountHandle ? ` @${c.accountHandle}` : "";
    const status =
      c.enrichStatus === "deep_enriched"
        ? "deep_enriched"
        : c.enrichStatus === "enriched"
          ? "fetched"
          : `${c.enrichStatus}`;
    const title = c.enrichedTitle ?? c.title ?? c.url;
    const snippet = c.enrichedSnippet ? ` — ${c.enrichedSnippet.slice(0, 200)}` : "";
    lines.push(`- [${c.platform}/${c.sourceType}] (${status})${handle} ${title} (${c.url})${snippet}`);

    // Include deep enrichment intelligence if available
    const deep = c.deepEnrichment?.consolidated;
    if (deep && c.enrichStatus === "deep_enriched") {
      const deepLines: string[] = [];

      if (deep.positioning) {
        deepLines.push(`  positioning: ${deep.positioning.slice(0, 120)}`);
      }
      if (deep.pricingSignal) {
        deepLines.push(`  pricing: ${deep.pricingSignal}`);
      }
      if (deep.ctaPattern) {
        deepLines.push(`  cta: ${deep.ctaPattern}`);
      }
      if (deep.keyFeatures?.length) {
        deepLines.push(`  features: ${deep.keyFeatures.slice(0, 3).join("; ")}`);
      }
      if (deep.keyBenefits?.length) {
        deepLines.push(`  benefits: ${deep.keyBenefits.slice(0, 3).join("; ")}`);
      }
      if (deep.contentThemes?.length) {
        deepLines.push(`  themes: ${deep.contentThemes.join(", ")}`);
      }
      if (deep.repeatedTerms?.length) {
        deepLines.push(`  terms: ${deep.repeatedTerms.slice(0, 5).join(", ")}`);
      }
      if (deep.socialLinks?.length) {
        deepLines.push(`  social: ${deep.socialLinks.slice(0, 3).join(", ")}`);
      }

      // Include successful crawled page URLs as evidence
      const successfulPages = c.deepEnrichment?.pages?.filter((p) => p.status === "success");
      if (successfulPages?.length) {
        const pageUrls = successfulPages.map((p) => `(${p.pageType})${p.url}`).slice(0, 4);
        deepLines.push(`  pages: ${pageUrls.join(", ")}`);
      }

      if (deepLines.length) {
        lines.push(...deepLines.map((l) => `${l}`));
      }
    }
  }

  return lines.join("\n");
}

interface FinishRunMeta {
  allQueryObjects: DiscoveryQuery[];
  adaptersUsed: Set<string>;
  candidatesFound: number;
  roundsRun: number;
  trace: DeepDiscoveryRoundTrace[];
  hypotheses: string[];
  synthesis: MarketSynthesis | null;
  usedFallbackSynthesis: boolean;
  synthesisModel?: string;
  synthesisProvider?: string;
  competitors_promoted?: number;
  competitor_accounts_promoted?: number;
  candidates_linked?: number;
  error: string | null;
}

async function finishRun(
  runId: string,
  projectId: string,
  status: "success" | "partial" | "failed",
  meta: FinishRunMeta
): Promise<void> {
  await saveDiscoveryRun({
    runId,
    projectId,
    status,
    queries: meta.allQueryObjects as unknown as Json,
    primaryAdapter: "firecrawl",
    fallbackAdapters: [...meta.adaptersUsed].filter((name) => name !== "firecrawl"),
    candidatesFound: meta.candidatesFound,
    error: meta.error,
    completed: true,
    metadata: {
      mode: "deep",
      rounds_run: meta.roundsRun,
      reasoning_trace: meta.trace,
      hypotheses: meta.hypotheses,
      synthesis: meta.synthesis,
      used_fallback_synthesis: meta.usedFallbackSynthesis,
      synthesis_model: meta.synthesisModel ?? null,
      synthesis_provider: meta.synthesisProvider ?? null,
      competitors_promoted: meta.competitors_promoted ?? 0,
      competitor_accounts_promoted: meta.competitor_accounts_promoted ?? 0,
      candidates_linked: meta.candidates_linked ?? 0,
    } as unknown as Json,
  });
}
