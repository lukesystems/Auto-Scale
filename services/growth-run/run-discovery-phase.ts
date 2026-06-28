import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { runDeepDiscovery } from "@/services/intelligence/deep-discovery/run-deep-discovery";
import { discoverVideoEvidence } from "@/services/intelligence/video/discover-video-evidence";
import { runPatternMining } from "@/services/intelligence/patterns/run-pattern-mining";
import { promoteCandidateToSource } from "@/services/intelligence/memory/promote-candidate";
import { enrichSourceFromUrl, scoreSourceRecord, type SourceRecord } from "@/services/trendwatch/enrich-sources";
import { classifySource } from "@/services/trendwatch/classify-source";
import { discoverTrendCandidates } from "@/services/trendhop/discover";
import { generateTrendHops } from "@/services/trendhop/generate";
import { bridgeVideoEvidenceToSources } from "@/services/intelligence/video/bridge-video-evidence-to-sources";
import type { SourcePlatform } from "@/lib/supabase/types";

type SupabaseClientType = SupabaseClient<Database>;
type DiscoverySubPhase = "deep_discovery" | "video_discovery" | "pattern_mining";

const MIN_EVIDENCE_COUNT = 3;
const MAX_AUTO_PROMOTE = 12;
const MAX_ENRICH_PENDING = 15;

export interface RunDiscoveryPhaseInput {
  projectId: string;
  growthRunId: string;
  client: SupabaseClientType;
  onSubPhase?: (
    phase: DiscoverySubPhase,
    status: "running" | "succeeded" | "failed" | "skipped",
    details?: Record<string, unknown>
  ) => Promise<void>;
}

export interface RunDiscoveryPhaseResult {
  evidenceCount: number;
  sourcesEnriched: number;
  candidatesPromoted: number;
  sourcesBridged: number;
  patternsMined: number;
  deepCandidatesSaved: number;
  videoEvidenceSaved: number;
  trendhopCandidates: number;
  lowConfidence: boolean;
}

export async function runDiscoveryPhase(
  input: RunDiscoveryPhaseInput
): Promise<RunDiscoveryPhaseResult> {
  let deepCandidatesSaved = 0;
  let videoEvidenceSaved = 0;
  let sourcesEnriched = 0;
  let candidatesPromoted = 0;
  let sourcesBridged = 0;
  let patternsMined = 0;
  let trendhopCandidates = 0;

  await input.onSubPhase?.("deep_discovery", "running");
  try {
    const deep = await runDeepDiscovery({ projectId: input.projectId, maxRounds: 4 });
    deepCandidatesSaved = deep.candidatesSaved;
    await input.onSubPhase?.("deep_discovery", "succeeded", {
      candidatesSaved: deep.candidatesSaved,
      candidatesFound: deep.candidatesFound,
      ok: deep.ok,
      synthesisSummary: deep.synthesis?.summary ?? null,
      competitors: (deep.synthesis?.competitors ?? []).slice(0, 6).map((c) => ({
        name: c.name,
        kind: c.kind,
        confidence: c.confidence,
        patterns: c.working_patterns.slice(0, 3),
        handles: c.handles.slice(0, 3),
      })),
      marketPatterns: (deep.synthesis?.market_patterns ?? []).slice(0, 5).map((p) => ({
        pattern: p.pattern,
        transferability: p.transferability,
        confidence: p.confidence,
      })),
      whiteSpace: (deep.synthesis?.white_space ?? []).slice(0, 4),
    });
  } catch (err) {
    await input.onSubPhase?.("deep_discovery", "failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await input.onSubPhase?.("video_discovery", "running");
  try {
    const video = await discoverVideoEvidence(input.projectId);
    videoEvidenceSaved = video.saved;
    candidatesPromoted += await autoPromotePendingCandidates(input.client, input.projectId);
    sourcesEnriched += await enrichPendingTrendWatchSources(input.client, input.projectId);
    const bridge = await bridgeVideoEvidenceToSources({
      projectId: input.projectId,
      client: input.client,
    });
    sourcesBridged = bridge.bridged + bridge.patched;
    await input.onSubPhase?.("video_discovery", "succeeded", {
      videoSaved: video.saved,
      sourcesEnriched,
      candidatesPromoted,
      sourcesBridged,
      ok: video.ok,
    });
  } catch (err) {
    await input.onSubPhase?.("video_discovery", "failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  await input.onSubPhase?.("pattern_mining", "running");
  try {
    trendhopCandidates = await runOptionalTrendHopDiscover(input.client, input.projectId);
    const mining = await runPatternMining({ projectId: input.projectId });
    patternsMined = mining.patternCount;
    await input.onSubPhase?.("pattern_mining", "succeeded", {
      patternsMined,
      trendhopCandidates,
      ok: mining.ok,
    });
  } catch (err) {
    await input.onSubPhase?.("pattern_mining", "failed", {
      error: err instanceof Error ? err.message : String(err),
    });
  }

  const evidenceCount = await countVideoEvidence(input.client, input.projectId);
  const lowConfidence = evidenceCount < MIN_EVIDENCE_COUNT;

  await input.client
    .from("growth_runs")
    .update({
      options: {
        ...(await loadRunOptions(input.client, input.growthRunId)),
        discovery_low_confidence: lowConfidence,
        discovery_evidence_count: evidenceCount,
      } as never,
    })
    .eq("id", input.growthRunId);

  return {
    evidenceCount,
    sourcesEnriched,
    candidatesPromoted,
    sourcesBridged,
    patternsMined,
    deepCandidatesSaved,
    videoEvidenceSaved,
    trendhopCandidates,
    lowConfidence,
  };
}

async function loadRunOptions(
  client: SupabaseClientType,
  growthRunId: string
): Promise<Record<string, unknown>> {
  const { data } = await client.from("growth_runs").select("options").eq("id", growthRunId).single();
  const options = data?.options;
  return options && typeof options === "object" && !Array.isArray(options)
    ? (options as Record<string, unknown>)
    : {};
}

async function countVideoEvidence(client: SupabaseClientType, projectId: string): Promise<number> {
  const { count } = await client
    .from("video_evidence")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}

async function enrichPendingTrendWatchSources(
  client: SupabaseClientType,
  projectId: string
): Promise<number> {
  const { data: pending } = await client
    .from("trendwatch_sources")
    .select(
      "id, source_url, platform, account_handle, account_type, caption, published_at, follower_count, views, likes, saves, shares, comments, transferability_score, notes"
    )
    .eq("project_id", projectId)
    .eq("fetch_status", "pending")
    .not("source_url", "is", null)
    .limit(MAX_ENRICH_PENDING);

  let enriched = 0;
  for (const row of pending ?? []) {
    try {
      const patch = await enrichSourceFromUrl(row as SourceRecord);
      const classifiedSource = { ...row, fetched_text: patch.fetched_text } as SourceRecord;
      const classification = await classifySource(classifiedSource);
      const rescored = scoreSourceRecord(
        { ...classifiedSource, transferability_score: classification.transferability_score },
        patch.fetch_status === "success",
        typeof patch.fetch_metadata.error === "string" ? patch.fetch_metadata.error : null
      );

      await client
        .from("trendwatch_sources")
        .update({
          fetch_status: patch.fetch_status,
          fetched_text: patch.fetched_text,
          fetch_metadata: patch.fetch_metadata as never,
          signal_score: rescored.score.signalScore,
          confidence_score: rescored.score.confidenceScore,
          scoring_reasons: rescored.score.reasons as never,
          distortion_risk: classification.distortion_risk,
          transferability_score: classification.transferability_score,
          account_type: classification.account_type,
          format: classification.format,
          hook: classification.hook,
          angle: classification.angle,
          visual_pattern: classification.visual_pattern,
          cta_pattern: classification.cta_pattern,
          audience_pain: classification.audience_pain,
          why_it_worked: classification.why_it_worked,
          how_to_adapt: classification.how_to_adapt,
          platform: (patch.platform as SourcePlatform) ?? (row.platform as SourcePlatform),
        })
        .eq("id", row.id);
      enriched += 1;
    } catch (err) {
      console.warn("[growth-run:discovery] enrich pending source failed", row.id, err);
    }
  }
  return enriched;
}

async function autoPromotePendingCandidates(
  client: SupabaseClientType,
  projectId: string
): Promise<number> {
  const { data: candidates } = await client
    .from("source_candidates")
    .select("id")
    .eq("project_id", projectId)
    .eq("review_status", "pending")
    .order("relevance_score", { ascending: false })
    .limit(MAX_AUTO_PROMOTE);

  let promoted = 0;
  for (const candidate of candidates ?? []) {
    try {
      await promoteCandidateToSource({
        projectId,
        candidateId: candidate.id,
        client,
      });
      promoted += 1;
    } catch (err) {
      console.warn("[growth-run:discovery] auto-promote failed", candidate.id, err);
    }
  }
  return promoted;
}

async function runOptionalTrendHopDiscover(
  client: SupabaseClientType,
  projectId: string
): Promise<number> {
  try {
    const [{ data: project }, { data: brief }] = await Promise.all([
      client.from("projects").select("niche").eq("id", projectId).maybeSingle(),
      client
        .from("product_briefs")
        .select("product_name, product_summary, target_customer, cta, category")
        .eq("project_id", projectId)
        .maybeSingle(),
    ]);

    const candidates = await discoverTrendCandidates({
      niche: project?.niche ?? brief?.category ?? null,
      productCategory: brief?.category ?? null,
      limitPerPlatform: 4,
    });
    if (!candidates.length) return 0;

    await generateTrendHops({
      product: {
        productName: brief?.product_name ?? null,
        productSummary: brief?.product_summary ?? null,
        targetCustomer: brief?.target_customer ?? null,
        niche: project?.niche ?? brief?.category ?? null,
        cta: brief?.cta ?? null,
      },
      candidates,
    });

    return candidates.length;
  } catch (err) {
    console.warn("[growth-run:discovery] optional TrendHop discover skipped", err);
    return 0;
  }
}
