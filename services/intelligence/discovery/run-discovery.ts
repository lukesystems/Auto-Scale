import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadDiscoveryContext } from "./load-context";
import { planDiscovery } from "./plan-discovery";
import { dedupeCandidates, canonicalizeUrl } from "./dedupe-candidates";
import { enrichCandidates } from "./enrich-candidate";
import { normalizeCoverageResults, searchWithCoverage } from "./search-coverage";
import {
  buildScoringContextFromDiscovery,
  scoreCandidates,
} from "./score-candidate";
import { buildCandidateSaveMetadata } from "./candidate-metadata";
import { saveDiscoveryRun } from "../memory/save-discovery-run";
import { saveSourceCandidates } from "../memory/save-source-candidates";
import type { DiscoveryPlan } from "./schema";

const MAX_RESULTS_PER_QUERY = 8;
const MAX_TOTAL_CANDIDATES = 40;

export interface RunDiscoveryInput {
  projectId: string;
  enrich?: boolean;
}

export interface RunDiscoveryResult {
  ok: boolean;
  runId: string | null;
  plan: DiscoveryPlan | null;
  candidatesFound: number;
  candidatesSaved: number;
  adaptersUsed: string[];
  error: string | null;
  usedFallbackPlan: boolean;
}

export async function runDiscovery(input: RunDiscoveryInput): Promise<RunDiscoveryResult> {
  const context = await loadDiscoveryContext(input.projectId);
  if (!context) {
    return {
      ok: false,
      runId: null,
      plan: null,
      candidatesFound: 0,
      candidatesSaved: 0,
      adaptersUsed: [],
      error: "Product brief required before discovery. Complete AutoBrief first.",
      usedFallbackPlan: false,
    };
  }

  const planned = await planDiscovery(context);
  const adaptersUsed = new Set<string>();

  let runId: string | null = null;
  try {
    runId = await saveDiscoveryRun({
      projectId: input.projectId,
      status: "running",
      queries: planned.plan.queries,
      primaryAdapter: "exa",
    });
  } catch (error) {
    return {
      ok: false,
      runId: null,
      plan: planned.plan,
      candidatesFound: 0,
      candidatesSaved: 0,
      adaptersUsed: [],
      error: error instanceof Error ? error.message : "Failed to start discovery run.",
      usedFallbackPlan: planned.usedFallback,
    };
  }

  const existingUrls = await loadExistingCandidateUrls(input.projectId);
  const normalized = [];
  const intentsByQuery = new Map(planned.plan.queries.map((q) => [q.query, q.intent]));

  for (const query of planned.plan.queries) {
    if (normalized.length >= MAX_TOTAL_CANDIDATES) break;

    const coverage = await searchWithCoverage(query.query, MAX_RESULTS_PER_QUERY);
    for (const adapter of coverage.adaptersUsed) adaptersUsed.add(adapter);

    const batch = normalizeCoverageResults({
      hits: coverage.results,
      query: query.query,
      reason: query.reason,
      intent: query.intent,
    });

    for (const candidate of batch) {
      if (normalized.length >= MAX_TOTAL_CANDIDATES) break;
      if (existingUrls.has(candidate.canonicalUrl)) continue;
      normalized.push(candidate);
      existingUrls.add(candidate.canonicalUrl);
    }
  }

  const deduped = dedupeCandidates(normalized);
  const scoringContext = buildScoringContextFromDiscovery(context);
  const scored = scoreCandidates(deduped, intentsByQuery, scoringContext);
  const qualityByUrl = new Map(
    scored.map((row) => [row.candidate.canonicalUrl, row.quality] as const)
  );
  const rankedCandidates = scored
    .map((row) => row.candidate)
    .sort((a, b) => b.relevanceScore - a.relevanceScore);
  const enriched = input.enrich === false ? rankedCandidates.map((candidate) => ({
    ...candidate,
    enrichStatus: "skipped" as const,
    enrichError: null,
    enrichedTitle: candidate.title,
    enrichedSnippet: candidate.snippet,
    fetchMetadata: {},
  })) : await enrichCandidates(rankedCandidates);

  let candidatesSaved = 0;
  if (runId && enriched.length) {
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
          metadata: buildCandidateSaveMetadata(candidate, quality),
        };
      })
    );
    candidatesSaved = ids.length;
  }

  const status = candidatesSaved > 0 ? "success" : deduped.length > 0 ? "partial" : "failed";
  const error = candidatesSaved > 0 ? null : "No new source candidates found. Try refining the brief or add sources manually.";

  if (runId) {
    await saveDiscoveryRun({
      runId,
      projectId: input.projectId,
      status,
      queries: planned.plan.queries,
      primaryAdapter: "exa",
      fallbackAdapters: [...adaptersUsed].filter((name) => name !== "exa"),
      candidatesFound: deduped.length,
      error,
      completed: true,
      metadata: {
        used_fallback_plan: planned.usedFallback,
        queries_run: planned.plan.queries.length,
      },
    });
  }

  return {
    ok: candidatesSaved > 0,
    runId,
    plan: planned.plan,
    candidatesFound: deduped.length,
    candidatesSaved,
    adaptersUsed: [...adaptersUsed],
    error: candidatesSaved > 0 ? null : error,
    usedFallbackPlan: planned.usedFallback,
  };
}

export async function loadExistingCandidateUrls(projectId: string): Promise<Set<string>> {
  const supabase = createSupabaseServerClient();
  const urls = new Set<string>();

  const [{ data: candidates }, { data: sources }] = await Promise.all([
    supabase.from("source_candidates").select("canonical_url, url").eq("project_id", projectId),
    supabase.from("trendwatch_sources").select("source_url").eq("project_id", projectId),
  ]);

  for (const row of candidates ?? []) {
    if (row.canonical_url) urls.add(canonicalizeUrl(row.canonical_url));
    if (row.url) urls.add(canonicalizeUrl(row.url));
  }
  for (const row of sources ?? []) {
    if (row.source_url) urls.add(canonicalizeUrl(row.source_url));
  }

  return urls;
}
