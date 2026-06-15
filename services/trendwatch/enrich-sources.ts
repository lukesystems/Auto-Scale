import type { AccountType, DistortionRisk, SourcePlatform } from "@/lib/supabase/types";
import { safeFetchUrl, type SafeFetchResult } from "./ingestion";
import {
  calculateRealSignalScore,
  estimateDistortionRisk,
  type SignalInputs,
  type ScoreOutput,
} from "./scoring";

export type FetchStatus = "pending" | "success" | "failed" | "skipped";

export interface SourceRecord {
  id: string;
  source_url: string | null;
  platform: SourcePlatform | string;
  account_handle: string | null;
  account_type: AccountType | string;
  caption?: string | null;
  published_at?: string | null;
  follower_count: number | null;
  views: number | null;
  likes: number | null;
  saves: number | null;
  shares: number | null;
  comments: number | null;
  transferability_score: number | null;
  notes: string | null;
  fetch_status?: FetchStatus | string | null;
  fetched_text?: string | null;
}

export interface EnrichedSource extends SourceRecord {
  fetch_status: FetchStatus;
  fetched_text: string | null;
  fetch_metadata: Record<string, unknown>;
  signal_score: number;
  confidence_score: number;
  scoring_reasons: string[];
  distortion_risk: DistortionRisk;
}

export interface TrendWatchSourceInput {
  url?: string;
  platform?: string;
  handle?: string;
  notes?: string;
  fetchStatus: FetchStatus;
  title?: string | null;
  description?: string | null;
  textSnippet?: string | null;
  confidenceScore: number;
  scoringReasons: string[];
}

function normalizeSaveSignal(saves: number | null, views: number | null): number | null {
  if (saves === null || views === null || views <= 0) return null;
  return Math.min(1, saves / views);
}

function normalizeEngagement(comments: number | null, shares: number | null, views: number | null): number | null {
  if (views === null || views <= 0) return null;
  const engaged = (comments ?? 0) + (shares ?? 0);
  if (engaged === 0 && comments === null && shares === null) return null;
  return Math.min(1, engaged / views);
}

export function deriveSignalInputs(source: SourceRecord, fetchOk: boolean): Partial<SignalInputs> {
  const hasContent = Boolean(source.fetched_text || source.caption || source.notes);
  const relevance =
    fetchOk && source.fetched_text
      ? 0.85
      : fetchOk && (source.caption || source.notes)
        ? 0.65
        : source.caption || source.notes
          ? 0.5
          : null;

  const formatTransferability =
    source.transferability_score != null && source.transferability_score > 0
      ? source.transferability_score
      : null;

  const saveSignal = normalizeSaveSignal(source.saves, source.views);
  const engagement = normalizeEngagement(source.comments, source.shares, source.views);

  const conversionIntent = engagement ?? saveSignal;

  const hasAccountContext =
    source.account_type !== "unknown" || source.follower_count != null;
  const accountFit = hasAccountContext
    ? (() => {
        const risk = estimateDistortionRisk({
          followerCount: source.follower_count,
          accountType: source.account_type,
        });
        if (risk === "low") return 0.85;
        if (risk === "medium") return 0.6;
        return 0.35;
      })()
    : null;

  if (!fetchOk && !hasContent) {
    return {
      relevance: null,
      formatTransferability: null,
      saveSignal: null,
      recency: null,
      conversionIntent: null,
      accountFit: null,
    };
  }

  let recency: number | null = null;
  if (source.published_at) {
    const ageDays = (Date.now() - new Date(source.published_at).getTime()) / 86_400_000;
    if (Number.isFinite(ageDays)) recency = Math.max(0, 1 - Math.max(0, ageDays) / 365);
  }

  return {
    relevance,
    formatTransferability,
    saveSignal,
    recency,
    conversionIntent,
    accountFit,
  };
}

export function scoreSourceRecord(
  source: SourceRecord,
  fetchOk: boolean,
  fetchError?: string | null
): { score: ScoreOutput; distortion_risk: DistortionRisk } {
  const inputs = deriveSignalInputs(source, fetchOk);
  const score = calculateRealSignalScore(inputs);
  const reasons = [...score.reasons];

  if (!fetchOk) {
    reasons.unshift(
      fetchError
        ? `Source fetch failed: ${fetchError}`
        : "Source URL was not fetched — metrics unverified."
    );
  }
  if (!source.source_url) {
    reasons.unshift("No source URL — manual notes only, low verification.");
  }

  const distortion_risk = estimateDistortionRisk({
    followerCount: source.follower_count,
    accountType: source.account_type,
  });

  return { score: { ...score, reasons }, distortion_risk };
}

export function buildFetchMetadata(fetch: SafeFetchResult): Record<string, unknown> {
  return {
    title: fetch.title,
    description: fetch.description,
    final_url: fetch.finalUrl,
    platform: fetch.platform,
    error: fetch.error,
    fetched_at: new Date().toISOString(),
  };
}

export async function enrichSourceFromUrl(
  source: SourceRecord
): Promise<{
  fetch_status: FetchStatus;
  fetched_text: string | null;
  fetch_metadata: Record<string, unknown>;
  signal_score: number;
  confidence_score: number;
  scoring_reasons: string[];
  distortion_risk: DistortionRisk;
  platform?: SourcePlatform;
}> {
  if (!source.source_url) {
    const scored = scoreSourceRecord(source, false, "No URL provided");
    return {
      fetch_status: "skipped",
      fetched_text: null,
      fetch_metadata: { skipped: true, reason: "no_url" },
      signal_score: scored.score.signalScore,
      confidence_score: scored.score.confidenceScore,
      scoring_reasons: scored.score.reasons,
      distortion_risk: scored.distortion_risk,
    };
  }

  const fetch = await safeFetchUrl(source.source_url);
  const fetchOk = fetch.status === "success";
  const enriched: SourceRecord = {
    ...source,
    fetched_text: [source.caption, fetch.textSnippet].filter(Boolean).join("\n\n") || null,
    platform: (fetch.platform as SourcePlatform | undefined) ?? (source.platform as SourcePlatform),
  };

  const scored = scoreSourceRecord(enriched, fetchOk, fetch.error);
  return {
    fetch_status: fetchOk ? "success" : "failed",
    fetched_text: enriched.fetched_text ?? null,
    fetch_metadata: buildFetchMetadata(fetch),
    signal_score: scored.score.signalScore,
    confidence_score: scored.score.confidenceScore,
    scoring_reasons: scored.score.reasons,
    distortion_risk: scored.distortion_risk,
    platform: (fetch.platform as SourcePlatform | undefined) ?? (source.platform as SourcePlatform),
  };
}

export function toTrendWatchSourceInput(source: EnrichedSource): TrendWatchSourceInput {
  const meta = source.fetch_metadata as { title?: string; description?: string };
  return {
    url: source.source_url ?? undefined,
    platform: source.platform,
    handle: source.account_handle ?? undefined,
    notes: source.notes ?? undefined,
    fetchStatus: source.fetch_status,
    title: meta.title ?? null,
    description: meta.description ?? null,
    textSnippet: source.fetched_text,
    confidenceScore: source.confidence_score,
    scoringReasons: source.scoring_reasons,
  };
}

export function aggregateRunConfidence(sources: EnrichedSource[]): {
  confidence: number;
  reasons: string[];
} {
  if (sources.length === 0) {
    return {
      confidence: 0,
      reasons: ["No sources provided — TrendWatch output is low confidence and unverified."],
    };
  }

  const avg =
    sources.reduce((sum, s) => sum + s.confidence_score, 0) / Math.max(sources.length, 1);
  const failed = sources.filter((s) => s.fetch_status === "failed").length;
  const reasons: string[] = [];
  if (failed > 0) {
    reasons.push(`${failed} source(s) failed to fetch — do not treat metrics as verified.`);
  }
  if (avg < 0.5) {
    reasons.push("Aggregate source confidence is below 50% — label insights as low confidence.");
  }
  return { confidence: Math.round(avg * 100) / 100, reasons };
}
