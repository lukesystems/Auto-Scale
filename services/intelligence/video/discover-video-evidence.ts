import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { estimateDistortionRisk } from "@/services/trendwatch/scoring";
import { loadLatestDeepDiscoverySynthesis } from "../deep-discovery/load-latest-synthesis";
import { searchWithCoverage } from "../discovery/search-coverage";
import { saveSourceCandidates } from "../memory/save-source-candidates";
import {
  detectCTA,
  extractEngagementFromText,
  extractHashtags,
  extractHook,
  extractVideoEvidence,
  extractVisibleFollowerCount,
  guessVideoFormat,
} from "./extract-video-evidence";
import { saveVideoEvidence } from "./save-video-evidence";
import { VideoEvidenceSchema, type VideoAccountType, type VideoEvidence } from "./schema";
import { canonicalizeVideoUrl, inspectVideoUrl, isSupportedPublicVideoUrl } from "./video-url";

const MAX_QUERIES = 12;
const RESULTS_PER_QUERY = 5;
const MAX_EVIDENCE = 20;
const EXTRACTION_CAP = 30;

/** Nadia sweet-spot band for format signal (10k–250k followers). */
const FOLLOWER_BAND_HINT = '("10k followers" OR "50k followers" OR "100k followers" OR "250k followers")';

export interface VideoDiscoveryContext {
  category?: string | null;
  primaryPain?: string | null;
  targetAudience?: string | string[] | null;
  positioning?: string | string[] | null;
  competitors?: string[];
  /** Handles surfaced by deep_discovery synthesis (seed video queries). */
  synthesisHandles?: string[];
  /** Market patterns from deep_discovery synthesis (seed format/hook queries). */
  marketPatterns?: string[];
}

export interface VideoDiscoveryQuery {
  query: string;
  reason: string;
  priority?: number;
}

type SearchHit = {
  url: string;
  title: string | null;
  snippet: string | null;
  adapter: string;
  query: string;
  reason: string;
  score: number;
};

type RankedCandidate = {
  hit: SearchHit;
  evidence: VideoEvidence;
  rank: number;
};

export function buildVideoDiscoveryQueries(context: VideoDiscoveryContext): VideoDiscoveryQuery[] {
  const category = firstText(context.category) ?? "startup growth";
  const pain = firstText(context.primaryPain);
  const audience = firstText(context.targetAudience);
  const positioning = firstText(context.positioning);
  const topics = unique([category, pain, audience, positioning].filter((value): value is string => Boolean(value))).slice(0, 2);
  const queries: VideoDiscoveryQuery[] = [];

  for (const handle of unique(context.synthesisHandles ?? []).slice(0, 5)) {
    const clean = handle.replace(/^@/, "");
    queries.push(
      {
        query: `site:tiktok.com/@${clean}`,
        reason: `Deep discovery surfaced @${clean} — hunt their TikTok content.`,
        priority: 100,
      },
      {
        query: `site:instagram.com/${clean} reel`,
        reason: `Deep discovery surfaced @${clean} — hunt their Reels.`,
        priority: 98,
      },
      {
        query: `site:youtube.com/@${clean} shorts`,
        reason: `Deep discovery surfaced @${clean} — hunt their Shorts.`,
        priority: 96,
      },
    );
  }

  for (const competitor of unique(context.competitors ?? []).slice(0, 3)) {
    queries.push(
      {
        query: `"${competitor}" unofficial TikTok OR shadow account`,
        reason: `Hunt unofficial/shadow accounts covering ${competitor}.`,
        priority: 90,
      },
      {
        query: `"${competitor}" "TikTok" ${FOLLOWER_BAND_HINT}`,
        reason: `Mid-tier TikTok creators discussing ${competitor} (10k–250k band).`,
        priority: 88,
      },
      {
        query: `"${competitor}" "YouTube Shorts" creator`,
        reason: `Creator-run Shorts about ${competitor}.`,
        priority: 86,
      },
      {
        query: `"${competitor}" "Instagram Reels"`,
        reason: `Public Reels presence for ${competitor}.`,
        priority: 84,
      },
    );
  }

  for (const pattern of unique(context.marketPatterns ?? []).slice(0, 3)) {
    const trimmed = pattern.trim().slice(0, 80);
    if (trimmed.length < 8) continue;
    queries.push(
      {
        query: `site:tiktok.com "${trimmed}" ${FOLLOWER_BAND_HINT}`,
        reason: `Deep discovery market pattern: ${trimmed.slice(0, 60)}.`,
        priority: 78,
      },
      {
        query: `site:youtube.com/shorts "${trimmed}"`,
        reason: `Shorts matching market pattern: ${trimmed.slice(0, 60)}.`,
        priority: 76,
      },
    );
  }

  for (const topic of topics) {
    queries.push(
      {
        query: `site:tiktok.com "${topic}" ${FOLLOWER_BAND_HINT}`,
        reason: `Mid-tier TikTok creators in ${topic} (10k–250k band).`,
        priority: 60,
      },
      {
        query: `site:youtube.com/shorts "${topic}" creator`,
        reason: `Creator YouTube Shorts on ${topic}.`,
        priority: 58,
      },
      {
        query: `site:instagram.com/reel "${topic}"`,
        reason: `Public Instagram Reels on ${topic}.`,
        priority: 56,
      },
    );
  }

  return dedupeQueries(queries)
    .sort((left, right) => (right.priority ?? 0) - (left.priority ?? 0))
    .slice(0, MAX_QUERIES);
}

export function dedupeVideoCandidates<T extends { url: string }>(items: T[]): T[] {
  const seenUrls = new Set<string>();
  const seenProfileHandles = new Set<string>();

  return items.filter((item) => {
    const canonical = canonicalizeVideoUrl(item.url);
    if (seenUrls.has(canonical)) return false;

    const info = inspectVideoUrl(item.url);
    if (info.sourceType !== "video" && info.accountHandle) {
      const handleKey = `${info.platform}:${info.accountHandle.toLowerCase()}`;
      if (seenProfileHandles.has(handleKey)) return false;
      seenProfileHandles.add(handleKey);
    }

    seenUrls.add(canonical);
    return true;
  });
}

export function inferVideoAccountType(opts: {
  evidence: Pick<VideoEvidence, "accountHandle" | "competitorId" | "followerCount">;
  competitorNames: string[];
  snippet: string | null;
  title: string | null;
  caption: string | null;
}): VideoAccountType {
  const text = [opts.title, opts.caption, opts.snippet].filter(Boolean).join(" ").toLowerCase();
  const handle = opts.evidence.accountHandle?.toLowerCase() ?? "";
  const matchedCompetitor = opts.competitorNames.find((name) => {
    const normalized = name.toLowerCase();
    return text.includes(normalized) || handle.includes(normalized.replace(/\s+/g, ""));
  });

  if (matchedCompetitor) {
    if (/\b(unofficial|fan account|parody|not affiliated|alternative|shadow)\b/i.test(text)) {
      return "shadow";
    }
    if (opts.evidence.competitorId) return "competitor";
    return "shadow";
  }

  const followers = opts.evidence.followerCount;
  if (followers != null && followers >= 10_000 && followers <= 250_000) return "creator";

  return "unknown";
}

export function rankNadiaVideoCandidate(item: {
  evidence: VideoEvidence;
  score: number;
  competitorNames?: string[];
  snippet?: string | null;
}): number {
  const { evidence, score, competitorNames = [], snippet } = item;
  const distortion = estimateDistortionRisk({
    followerCount: evidence.followerCount,
    accountType: evidence.accountType,
  });

  if (distortion === "high" && evidence.accountType !== "official") return -Infinity;

  const followers = evidence.followerCount;
  if (followers != null && followers > 500_000) return -Infinity;

  let rank = score;

  if (evidence.accountType === "shadow") rank += 0.35;
  else if (evidence.accountType === "creator") rank += 0.25;
  else if (evidence.accountType === "official") rank += 0.05;

  if (distortion === "medium") rank -= 0.1;
  if (distortion === "low") rank += 0.1;

  if (followers != null && followers >= 10_000 && followers <= 250_000) rank += 0.15;

  const meta = parseRecord(evidence.metadata);
  const proxies = parseRecord(meta.engagement_proxies);
  const views = evidence.viewCount ?? asNumber(proxies.views);
  const saves = asNumber(proxies.saves);
  const likes = evidence.likeCount ?? asNumber(proxies.likes);

  if (views != null) {
    if (views >= 10_000 && views <= 250_000) rank += 0.12;
    else if (views >= 1_000 && views < 10_000) rank += 0.06;
  }
  if (saves != null && saves >= 50) rank += 0.1;
  else if (likes != null && likes >= 100) rank += 0.05;

  if (evidence.postedAt) {
    const ageMs = Date.now() - new Date(evidence.postedAt).getTime();
    if (ageMs < 30 * 86_400_000) rank += 0.08;
    else if (ageMs < 90 * 86_400_000) rank += 0.04;
  } else if (snippet && /\b(today|yesterday|this week|\d+\s+(?:hours?|days?)\s+ago)\b/i.test(snippet)) {
    rank += 0.05;
  }

  const text = [evidence.title, evidence.caption, snippet].filter(Boolean).join(" ").toLowerCase();
  const competitorHits = competitorNames.filter((name) => text.includes(name.toLowerCase())).length;
  if (competitorHits > 0) rank += 0.05 * Math.min(competitorHits, 3);

  return rank;
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

  const deepCtx = await loadLatestDeepDiscoverySynthesis(projectId);
  const competitorNames = unique([
    ...(competitors ?? []).map((item) => item.name),
    ...jsonStrings(brief.competitors),
    ...deepCtx.competitorNames,
  ]);
  const queries = buildVideoDiscoveryQueries({
    category: brief.market_category ?? brief.category,
    primaryPain: brief.primary_pain,
    targetAudience: firstText(brief.target_customer) ?? jsonStrings(brief.target_audience),
    positioning: jsonStrings(brief.positioning_angles),
    competitors: competitorNames,
    synthesisHandles: deepCtx.handles,
    marketPatterns: (deepCtx.synthesis?.market_patterns ?? [])
      .filter((item) => item.transferability >= 0.4)
      .map((item) => item.pattern),
  });

  const { data: run, error: runError } = await supabase.from("source_discovery_runs").insert({
    project_id: projectId,
    status: "running",
    queries: queries as unknown as Json,
    primary_adapter: "coverage",
    metadata: { kind: "video_evidence", api_free: true, nadia_rules: true } as Json,
  }).select("id").single();
  if (runError || !run) throw new Error(runError?.message ?? "Failed to start video discovery.");

  const adapters = new Set<string>();
  const hits: SearchHit[] = [];
  for (const query of queries) {
    const coverage = await searchWithCoverage(query.query, RESULTS_PER_QUERY);
    coverage.adaptersUsed.forEach((adapter) => adapters.add(adapter));
    for (const hit of coverage.results) {
      if (!isSupportedPublicVideoUrl(hit.url)) continue;
      hits.push({
        url: hit.url,
        title: hit.title,
        snippet: hit.snippet,
        adapter: hit.adapters.join("+") || "unknown",
        query: query.query,
        reason: query.reason,
        score: hit.coverageScore,
      });
    }
    if (hits.length >= EXTRACTION_CAP) break;
  }

  const keywords = briefKeywords(brief);
  const ranked = await rankExtractedCandidates(
    dedupeVideoCandidates(hits).slice(0, EXTRACTION_CAP),
    competitorNames,
  );
  const candidates = ranked.slice(0, MAX_EVIDENCE);

  await saveSourceCandidates(candidates.map((candidate) => ({
    discoveryRunId: run.id,
    projectId,
    url: candidate.hit.url,
    canonicalUrl: canonicalizeVideoUrl(candidate.hit.url),
    title: candidate.hit.title,
    snippet: candidate.hit.snippet,
    sourceType: "video",
    platform: inspectVideoUrl(candidate.hit.url).platform,
    adapter: candidate.hit.adapter,
    discoveryQuery: candidate.hit.query,
    discoveryReason: candidate.hit.reason,
    relevanceScore: candidate.rank,
    metadata: {
      video_source_type: inspectVideoUrl(candidate.hit.url).sourceType,
      api_free: true,
      follower_count: candidate.evidence.followerCount,
      account_type: candidate.evidence.accountType,
      distortion_risk: estimateDistortionRisk({
        followerCount: candidate.evidence.followerCount,
        accountType: candidate.evidence.accountType,
      }),
    } as Json,
  })));
  const { data: savedCandidates } = await supabase
    .from("source_candidates")
    .select("id, canonical_url")
    .eq("discovery_run_id", run.id);
  const candidateIdByUrl = new Map((savedCandidates ?? []).map((candidate) => [candidate.canonical_url, candidate.id]));

  let saved = 0;
  for (const candidate of candidates) {
    const sourceCandidateId = candidateIdByUrl.get(canonicalizeVideoUrl(candidate.hit.url)) ?? null;
    try {
      await saveVideoEvidence({
        evidence: candidate.evidence,
        projectId,
        sourceCandidateId,
        briefKeywords: keywords,
      });
      saved += 1;
      if (sourceCandidateId) {
        await supabase.from("source_candidates").update({
          enrich_status: candidate.evidence.fetchStatus === "success" ? "enriched" : "failed",
        }).eq("id", sourceCandidateId);
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

async function rankExtractedCandidates(
  hits: SearchHit[],
  competitorNames: string[],
): Promise<RankedCandidate[]> {
  const ranked: RankedCandidate[] = [];

  for (const hit of hits) {
    const extracted = await extractVideoEvidence(hit.url);
    const evidence = enrichNadiaEvidence(extracted, hit, competitorNames);
    const rank = rankNadiaVideoCandidate({
      evidence,
      score: hit.score,
      competitorNames,
      snippet: hit.snippet,
    });
    if (rank === -Infinity) continue;
    ranked.push({ hit, evidence, rank });
  }

  ranked.sort((left, right) => right.rank - left.rank);
  return ranked;
}

function enrichNadiaEvidence(
  extracted: VideoEvidence,
  hit: SearchHit,
  competitorNames: string[],
): VideoEvidence {
  const merged = mergeSearchEvidence(extracted, hit.title, hit.snippet);
  const followerText = [hit.snippet, hit.title, merged.caption, merged.title].filter(Boolean).join(" ");
  const followerCount = merged.followerCount ?? extractVisibleFollowerCount(followerText);
  const accountType = inferVideoAccountType({
    evidence: { ...merged, followerCount, competitorId: merged.competitorId },
    competitorNames,
    snippet: hit.snippet,
    title: hit.title,
    caption: merged.caption,
  });
  const distortionRisk = estimateDistortionRisk({ followerCount, accountType });

  return VideoEvidenceSchema.parse({
    ...merged,
    followerCount,
    accountType,
    metadata: {
      ...merged.metadata,
      distortion_risk: distortionRisk,
      nadia_rank_inputs: { accountType, followerCount, distortionRisk },
    },
  });
}

function mergeSearchEvidence(evidence: VideoEvidence, title: string | null, snippet: string | null): VideoEvidence {
  const mergedTitle = evidence.title ?? title;
  const caption = evidence.caption ?? snippet;
  const text = [mergedTitle, caption, snippet].filter(Boolean).join(" ");
  const engagement = extractEngagementFromText(text);
  const hookSource = caption ?? mergedTitle ?? snippet ?? "";

  return VideoEvidenceSchema.parse({
    ...evidence,
    title: mergedTitle,
    caption,
    hashtags: evidence.hashtags.length ? evidence.hashtags : extractHashtags(text),
    viewCount: evidence.viewCount ?? engagement.views,
    likeCount: evidence.likeCount ?? engagement.likes,
    commentCount: evidence.commentCount ?? engagement.comments,
    shareCount: evidence.shareCount ?? engagement.shares,
    detectedHook: evidence.detectedHook ?? extractHook(hookSource),
    detectedCTA: evidence.detectedCTA ?? detectCTA(text),
    formatGuess: evidence.formatGuess !== "unknown" ? evidence.formatGuess : guessVideoFormat(text),
    metadata: {
      ...evidence.metadata,
      search_index_fallback: evidence.fetchStatus !== "success",
      engagement_proxies: engagement,
    },
  });
}

function parseRecord(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
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
