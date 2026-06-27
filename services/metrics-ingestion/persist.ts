import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { MetricsSnapshot } from "./types";

type AdminClient = SupabaseClient<Database>;

export interface PersistMetricsInput {
  projectId: string;
  scheduleItemId: string;
  videoId: string;
  growthRunId: string;
  platform: string;
  remotePostId?: string | null;
  snapshot: MetricsSnapshot;
  growthExperimentResultId?: string | null;
  linkClicks?: number | null;
  signups?: number | null;
  completionRate?: number | null;
}

export interface PersistMetricsResult {
  snapshotId: string;
  videoRunMetricId: string;
}

export async function persistMetricsSnapshot(
  admin: AdminClient,
  input: PersistMetricsInput
): Promise<PersistMetricsResult> {
  const { data: snapshotRow, error: snapshotError } = await admin
    .from("metrics_snapshots")
    .insert({
      project_id: input.projectId,
      schedule_item_id: input.scheduleItemId,
      video_id: input.videoId,
      growth_experiment_result_id: input.growthExperimentResultId ?? null,
      remote_post_id: input.remotePostId ?? null,
      platform: input.platform,
      source: input.snapshot.source,
      fetched_at: input.snapshot.fetchedAt,
      views: input.snapshot.views,
      likes: input.snapshot.likes,
      comments: input.snapshot.comments,
      shares: input.snapshot.shares,
      saves: input.snapshot.saves,
      watch_time_seconds: input.snapshot.watchTimeSeconds,
      impressions: input.snapshot.impressions,
      engagement_rate: input.snapshot.engagementRate,
      raw: input.snapshot.raw as never,
    })
    .select("id")
    .single();

  if (snapshotError || !snapshotRow) {
    throw new Error(`metrics_snapshots insert failed: ${snapshotError?.message ?? "unknown"}`);
  }

  const completionRate =
    input.completionRate ??
    (input.snapshot.views != null &&
    input.snapshot.views > 0 &&
    input.snapshot.watchTimeSeconds != null
      ? Math.min(1, input.snapshot.watchTimeSeconds / input.snapshot.views)
      : null);

  const metricSource =
    input.snapshot.source === "manual" ? "manual" : ("platform_api" as const);

  const { data: metricRow, error: metricError } = await admin
    .from("video_run_metrics")
    .insert({
      project_id: input.projectId,
      growth_run_id: input.growthRunId,
      schedule_item_id: input.scheduleItemId,
      video_id: input.videoId,
      source: metricSource,
      views: input.snapshot.views,
      likes: input.snapshot.likes,
      comments: input.snapshot.comments,
      shares: input.snapshot.shares,
      saves: input.snapshot.saves,
      watch_time_seconds: input.snapshot.watchTimeSeconds,
      completion_rate: completionRate,
      link_clicks: input.linkClicks ?? null,
      signups: input.signups ?? null,
      metadata: {
        metrics_snapshot_id: snapshotRow.id,
        ingestion_source: input.snapshot.source,
      } as never,
    })
    .select("id")
    .single();

  if (metricError || !metricRow) {
    throw new Error(`video_run_metrics insert failed: ${metricError?.message ?? "unknown"}`);
  }

  const { data: experimentResult } = await admin
    .from("growth_experiment_results")
    .select("id, metric_summary")
    .eq("video_id", input.videoId)
    .maybeSingle();

  if (experimentResult) {
    const prior =
      experimentResult.metric_summary && typeof experimentResult.metric_summary === "object"
        ? (experimentResult.metric_summary as Record<string, unknown>)
        : {};

    await admin
      .from("growth_experiment_results")
      .update({
        latest_metrics_snapshot_id: snapshotRow.id,
        metric_summary: {
          ...prior,
          views: input.snapshot.views ?? prior.views ?? 0,
          likes: input.snapshot.likes,
          comments: input.snapshot.comments,
          shares: input.snapshot.shares,
          saves: input.snapshot.saves,
          save_rate:
            input.snapshot.views != null &&
            input.snapshot.views > 0 &&
            input.snapshot.saves != null
              ? input.snapshot.saves / input.snapshot.views
              : (prior.save_rate as number | undefined) ?? null,
          watch_time_seconds: input.snapshot.watchTimeSeconds,
          impressions: input.snapshot.impressions,
          engagement_rate: input.snapshot.engagementRate,
          metrics_source: input.snapshot.source,
          metrics_synced_at: input.snapshot.fetchedAt,
        } as never,
      })
      .eq("id", experimentResult.id);
  }

  return { snapshotId: snapshotRow.id, videoRunMetricId: metricRow.id };
}

export function buildManualMetricsSnapshot(fields: {
  views?: number | null;
  likes?: number | null;
  comments?: number | null;
  shares?: number | null;
  saves?: number | null;
  completionRate?: number | null;
  linkClicks?: number | null;
  signups?: number | null;
}): MetricsSnapshot {
  const views = fields.views ?? null;
  const likes = fields.likes ?? null;
  const comments = fields.comments ?? null;
  const shares = fields.shares ?? null;
  const saves = fields.saves ?? null;

  return {
    fetchedAt: new Date().toISOString(),
    source: "manual",
    views,
    likes,
    comments,
    shares,
    saves,
    watchTimeSeconds: null,
    impressions: null,
    engagementRate:
      views != null && views > 0
        ? ((likes ?? 0) + (comments ?? 0) + (shares ?? 0) + (saves ?? 0)) / views
        : null,
    raw: {
      manual: true,
      completion_rate: fields.completionRate ?? null,
      link_clicks: fields.linkClicks ?? null,
      signups: fields.signups ?? null,
    },
  };
}
