import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { searchWithCoverage } from "../discovery/search-coverage";
import { saveSourceCandidates } from "../memory/save-source-candidates";
import { detectCTA, extractHashtags, extractHook, extractVideoEvidence, guessVideoFormat } from "./extract-video-evidence";
import { saveVideoEvidence } from "./save-video-evidence";
import { VideoEvidenceSchema, type VideoEvidence } from "./schema";
import { canonicalizeVideoUrl, inspectVideoUrl, isSupportedPublicVideoUrl } from "./video-url";

const MAX_QUERIES = 9;
const RESULTS_PER_QUERY = 4;
const MAX_EVIDENCE = 18;

export interface VideoDiscoveryContext {
  category?: string | null;
  primaryPain?: string | null;
  targetAudience?: string | string[] | null;
  positioning?: string | string[] | null;
  competitors?: string[];
}

export interface VideoDiscoveryQuery {
  query: string;
  reason: string;
}

export function buildVideoDiscoveryQueries(context: VideoDiscoveryContext): VideoDiscoveryQuery[] {
  const category = firstText(context.category) ?? "startup growth";
  const pain = firstText(context.primaryPain);
  const audience = firstText(context.targetAudience);
  const positioning = firstText(context.positioning);
  const topics = unique([category, pain, audience, positioning].filter((value): value is string => Boolean(value))).slice(0, 2);
  const queries: VideoDiscoveryQuery[] = [];

  for (const topic of topics) {
    queries.push(
      { query: `site:tiktok.com/@ "${topic}"`, reason: `Public TikTok evidence for ${topic}.` },
      { query: `site:youtube.com/shorts "${topic}"`, reason: `Public YouTube Shorts evidence for ${topic}.` },
      { query: `site:instagram.com/reel "${topic}"`, reason: `Public Instagram Reels evidence for ${topic}.` },
    );
  }
  for (const competitor of unique(context.competitors ?? []).slice(0, 1)) {
    queries.push(
      { query: `"${competitor}" "TikTok"`, reason: `Find ${competitor}'s public TikTok presence.` },
      { query: `"${competitor}" "YouTube Shorts"`, reason: `Find ${competitor}'s public Shorts presence.` },
      { query: `"${competitor}" "Instagram"`, reason: `Find ${competitor}'s public Instagram presence.` },
    );
  }
  return dedupeQueries(queries).slice(0, MAX_QUERIES);
}

export function dedupeVideoCandidates<T extends { url: string }>(items: T[]): T[] {
  const seen = new Set<string>();
  return items.filter((item) => {
    const canonical = canonicalizeVideoUrl(item.url);
    if (seen.has(canonical)) return false;
    seen.add(canonical);
    return true;
  });
}

export async function discoverVideoEvidence(projectId: string): Promise<{
  ok: boolean;
  discovered: number;
  saved: number;
  queries: VideoDiscoveryQuery[];
  adaptersUsed: string[];
  error: string | null;
}> {
  const supabase = createSupabaseServerClient();
  const [{ data: brief }, { data: competitors }] = await Promise.all([
    supabase.from("product_briefs").select("category, market_category, primary_pain, target_customer, target_audience, positioning_angles, competitors").eq("project_id", projectId).maybeSingle(),
    supabase.from("competitors").select("name").eq("project_id", projectId),
  ]);
  if (!brief) return { ok: false, discovered: 0, saved: 0, queries: [], adaptersUsed: [], error: "Save a Product Brief before discovering video evidence." };

  const competitorNames = unique([
    ...(competitors ?? []).map((item) => item.name),
    ...jsonStrings(brief.competitors),
  ]);
  const queries = buildVideoDiscoveryQueries({
    category: brief.market_category ?? brief.category,
    primaryPain: brief.primary_pain,
    targetAudience: firstText(brief.target_customer) ?? jsonStrings(brief.target_audience),
    positioning: jsonStrings(brief.positioning_angles),
    competitors: competitorNames,
  });

  const { data: run, error: runError } = await supabase.from("source_discovery_runs").insert({
    project_id: projectId,
    status: "running",
    queries: queries as unknown as Json,
    primary_adapter: "coverage",
    metadata: { kind: "video_evidence", api_free: true } as Json,
  }).select("id").single();
  if (runError || !run) throw new Error(runError?.message ?? "Failed to start video discovery.");

  const adapters = new Set<string>();
  const hits: Array<{ url: string; title: string | null; snippet: string | null; adapter: string; query: string; reason: string; score: number }> = [];
  for (const query of queries) {
    const coverage = await searchWithCoverage(query.query, RESULTS_PER_QUERY);
    coverage.adaptersUsed.forEach((adapter) => adapters.add(adapter));
    for (const hit of coverage.results) {
      if (!isSupportedPublicVideoUrl(hit.url)) continue;
      hits.push({ url: hit.url, title: hit.title, snippet: hit.snippet, adapter: hit.adapters.join("+") || "unknown", query: query.query, reason: query.reason, score: hit.coverageScore });
    }
    if (hits.length >= MAX_EVIDENCE) break;
  }

  const candidates = dedupeVideoCandidates(hits).slice(0, MAX_EVIDENCE);
  await saveSourceCandidates(candidates.map((candidate) => ({
    discoveryRunId: run.id,
    projectId,
    url: candidate.url,
    canonicalUrl: canonicalizeVideoUrl(candidate.url),
    title: candidate.title,
    snippet: candidate.snippet,
    sourceType: "video",
    platform: inspectVideoUrl(candidate.url).platform,
    adapter: candidate.adapter,
    discoveryQuery: candidate.query,
    discoveryReason: candidate.reason,
    relevanceScore: candidate.score,
    metadata: { video_source_type: inspectVideoUrl(candidate.url).sourceType, api_free: true } as Json,
  })));
  const { data: savedCandidates } = await supabase
    .from("source_candidates")
    .select("id, canonical_url")
    .eq("discovery_run_id", run.id);
  const candidateIdByUrl = new Map((savedCandidates ?? []).map((candidate) => [candidate.canonical_url, candidate.id]));

  const keywords = briefKeywords(brief);
  let saved = 0;
  for (let index = 0; index < candidates.length; index += 1) {
    const candidate = candidates[index];
    if (!candidate) continue;
    const extracted = await extractVideoEvidence(candidate.url);
    const evidence = mergeSearchEvidence(extracted, candidate.title, candidate.snippet);
    const sourceCandidateId = candidateIdByUrl.get(canonicalizeVideoUrl(candidate.url)) ?? null;
    try {
      await saveVideoEvidence({ evidence, projectId, sourceCandidateId, briefKeywords: keywords });
      saved += 1;
      if (sourceCandidateId) {
        await supabase.from("source_candidates").update({ enrich_status: evidence.fetchStatus === "success" ? "enriched" : "failed" }).eq("id", sourceCandidateId);
      }
    } catch {
      if (sourceCandidateId) await supabase.from("source_candidates").update({ enrich_status: "failed" }).eq("id", sourceCandidateId);
    }
  }

  const status = saved === candidates.length ? "success" : saved > 0 ? "partial" : "failed";
  await supabase.from("source_discovery_runs").update({
    status,
    candidates_found: candidates.length,
    fallback_adapters: [...adapters] as Json,
    completed_at: new Date().toISOString(),
    error: saved ? null : "No public short-form video evidence was found.",
  }).eq("id", run.id);

  return { ok: saved > 0, discovered: candidates.length, saved, queries, adaptersUsed: [...adapters], error: saved ? null : "No public video evidence found with configured search providers." };
}

function mergeSearchEvidence(evidence: VideoEvidence, title: string | null, snippet: string | null): VideoEvidence {
  const mergedTitle = evidence.title ?? title;
  const caption = evidence.caption ?? snippet;
  const text = [mergedTitle, caption].filter(Boolean).join(" ");
  return VideoEvidenceSchema.parse({
    ...evidence,
    title: mergedTitle,
    caption,
    hashtags: evidence.hashtags.length ? evidence.hashtags : extractHashtags(text),
    detectedHook: evidence.detectedHook ?? extractHook(caption ?? mergedTitle ?? ""),
    detectedCTA: evidence.detectedCTA ?? detectCTA(text),
    formatGuess: evidence.formatGuess !== "unknown" ? evidence.formatGuess : guessVideoFormat(text),
    metadata: { ...evidence.metadata, search_index_fallback: evidence.fetchStatus !== "success" },
  });
}

function jsonStrings(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => typeof item === "string" ? [item] : item && typeof item === "object" && typeof (item as { name?: unknown }).name === "string" ? [(item as { name: string }).name] : []);
}

function firstText(value: unknown): string | null {
  if (typeof value === "string") return value.trim() || null;
  return jsonStrings(value)[0] ?? null;
}

function unique(values: string[]): string[] {
  return [...new Set(values.map((value) => value.trim()).filter(Boolean))];
}

function dedupeQueries(queries: VideoDiscoveryQuery[]): VideoDiscoveryQuery[] {
  const seen = new Set<string>();
  return queries.filter((query) => !seen.has(query.query) && Boolean(seen.add(query.query)));
}

function briefKeywords(brief: Record<string, unknown>): string[] {
  return unique([
    firstText(brief.market_category), firstText(brief.category), firstText(brief.primary_pain), firstText(brief.target_customer),
    ...jsonStrings(brief.target_audience), ...jsonStrings(brief.positioning_angles),
  ].filter((value): value is string => Boolean(value)));
}
