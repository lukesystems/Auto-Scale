import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, AccountType, SourcePlatform } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { estimateDistortionRisk } from "@/services/trendwatch/scoring";
import { sourceHasMineableSignals, type MineableSourceRow } from "../patterns/load-pattern-context";
import { canonicalizeVideoUrl } from "./video-url";

type SupabaseClientType = SupabaseClient<Database>;
type VideoEvidenceRow = Database["public"]["Tables"]["video_evidence"]["Row"];

const MAX_BRIDGE = 24;

function parseMetadata(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  return value as Record<string, unknown>;
}

function urlMatchKey(url: string): string {
  try {
    return canonicalizeVideoUrl(url);
  } catch {
    return url.trim().toLowerCase();
  }
}

function mapPlatform(platform: VideoEvidenceRow["platform"]): SourcePlatform {
  if (platform === "tiktok" || platform === "instagram" || platform === "youtube") return platform;
  return "other";
}

function buildBridgeNotes(row: VideoEvidenceRow): string {
  return [
    "Auto-bridged from video_evidence for pattern mining.",
    row.topic_guess ? `Topic: ${row.topic_guess}` : null,
    row.video_url ? `URL: ${row.video_url}` : null,
  ]
    .filter(Boolean)
    .join("\n");
}

export function videoEvidenceHasMineableSignals(row: VideoEvidenceRow): boolean {
  return Boolean(
    row.detected_hook?.trim() ||
      row.caption?.trim() ||
      row.title?.trim() ||
      row.detected_cta?.trim() ||
      row.topic_guess?.trim() ||
      row.account_handle?.trim() ||
      (row.format_guess && row.format_guess !== "unknown")
  );
}

export function videoEvidenceToSourcePatch(row: VideoEvidenceRow): Record<string, unknown> {
  const meta = parseMetadata(row.metadata);
  const followerCount = typeof meta.follower_count === "number" ? meta.follower_count : null;
  const accountType = (typeof meta.account_type === "string" ? meta.account_type : "unknown") as AccountType;
  const hook = row.detected_hook?.trim() || null;
  const caption = row.caption?.trim() || row.title?.trim() || null;
  const format = row.format_guess !== "unknown" ? row.format_guess : null;

  return {
    source_url: row.video_url,
    platform: mapPlatform(row.platform),
    account_handle: row.account_handle,
    account_type: accountType,
    caption,
    hook,
    format,
    cta_pattern: row.detected_cta?.trim() || null,
    angle: row.topic_guess?.trim() || null,
    published_at: row.posted_at,
    follower_count: followerCount,
    views: row.view_count,
    likes: row.like_count,
    comments: row.comment_count,
    shares: row.share_count,
    fetch_status: row.fetch_status === "success" ? "success" : row.fetch_status === "failed" ? "failed" : "skipped",
    fetch_metadata: { bridged_from: "video_evidence", video_evidence_id: row.id },
    distortion_risk: estimateDistortionRisk({ followerCount, accountType }),
    notes: buildBridgeNotes(row),
    confidence_score: row.source_confidence,
    signal_score: row.source_confidence,
    transferability_score: 0.65,
  };
}

/**
 * Promote enriched video_evidence rows into trendwatch_sources so pattern mining
 * can extract hooks/formats/CTAs even when URL fetch/classify on promotion failed.
 */
export async function bridgeVideoEvidenceToSources(input: {
  projectId: string;
  client?: SupabaseClientType;
  limit?: number;
}): Promise<{ bridged: number; patched: number }> {
  const client = input.client ?? createSupabaseServerClient();
  const limit = input.limit ?? MAX_BRIDGE;

  const { data: evidenceRows } = await client
    .from("video_evidence")
    .select("*")
    .eq("project_id", input.projectId)
    .order("source_confidence", { ascending: false })
    .limit(limit);

  if (!evidenceRows?.length) return { bridged: 0, patched: 0 };

  const { data: existingSources } = await client
    .from("trendwatch_sources")
    .select(
      "id, source_url, hook, angle, format, cta_pattern, visual_pattern, audience_pain, why_it_worked, how_to_adapt, fetched_text, notes, caption"
    )
    .eq("project_id", input.projectId);

  const sourceByUrl = new Map<string, { id: string; row: MineableSourceRow }>();
  for (const source of existingSources ?? []) {
    if (!source.source_url) continue;
    sourceByUrl.set(urlMatchKey(source.source_url), {
      id: source.id,
      row: { ...source, project_id: input.projectId } as MineableSourceRow,
    });
  }

  let bridged = 0;
  let patched = 0;

  for (const evidence of evidenceRows) {
    if (!videoEvidenceHasMineableSignals(evidence)) continue;

    const patch = videoEvidenceToSourcePatch(evidence);
    const key = urlMatchKey(evidence.canonical_url || evidence.video_url);
    const existing = sourceByUrl.get(key);

    if (existing) {
      if (!sourceHasMineableSignals(existing.row)) {
        const { error } = await client
          .from("trendwatch_sources")
          .update(patch as never)
          .eq("id", existing.id);
        if (!error) patched += 1;
      }
      continue;
    }

    const { data: inserted, error } = await client
      .from("trendwatch_sources")
      .insert({
        project_id: input.projectId,
        ...patch,
      } as never)
      .select("id, source_url, hook, angle, format, cta_pattern, caption, fetched_text, notes")
      .single();

    if (!error && inserted) {
      bridged += 1;
      sourceByUrl.set(key, {
        id: inserted.id,
        row: { ...inserted, project_id: input.projectId } as MineableSourceRow,
      });
    }
  }

  return { bridged, patched };
}
