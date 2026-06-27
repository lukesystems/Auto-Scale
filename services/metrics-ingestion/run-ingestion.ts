import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getProviderModeForUser } from "@/lib/provider-mode";
import {
  getPublishingProviderId,
  isRemotePublishingEnabled,
  resolvePublishingCredentials,
} from "@/services/social-publishing";
import { getMetricsAdapter } from "./index";
import { isWithinMetricsWindow } from "./eligibility";
import { persistMetricsSnapshot } from "./persist";
import type { IngestionRunSummary, ScheduleItemIngestionResult } from "./types";

const DEFAULT_WINDOW_DAYS = 30;

type ScheduleItemRow = {
  id: string;
  project_id: string;
  growth_run_id: string;
  video_id: string;
  platform: string;
  status: string;
  postiz_post_id: string | null;
  posted_url: string | null;
  posted_at: string | null;
  scheduled_for: string;
};

export async function ingestMetricsForScheduleItem(
  scheduleItemId: string,
  opts?: { ownerId?: string }
): Promise<ScheduleItemIngestionResult> {
  const admin = createSupabaseAdminClient();

  const { data: item, error } = await admin
    .from("schedule_items")
    .select(
      "id, project_id, growth_run_id, video_id, platform, status, postiz_post_id, posted_url, posted_at, scheduled_for"
    )
    .eq("id", scheduleItemId)
    .maybeSingle();

  if (error || !item) {
    return { scheduleItemId, ok: false, reason: error?.message ?? "schedule item not found" };
  }

  if (item.status !== "posted") {
    return { scheduleItemId, ok: false, reason: `schedule item status is ${item.status}, not posted` };
  }

  if (!item.postiz_post_id) {
    return { scheduleItemId, ok: false, reason: "no remote post id on schedule item" };
  }

  const { data: project } = await admin
    .from("projects")
    .select("owner_id")
    .eq("id", item.project_id)
    .maybeSingle();

  const ownerId = opts?.ownerId ?? project?.owner_id;
  if (!ownerId) {
    return { scheduleItemId, ok: false, reason: "project owner not found" };
  }

  const providerId = getPublishingProviderId();
  const mode = await getProviderModeForUser(ownerId);
  const credentials = await resolvePublishingCredentials(ownerId, mode, providerId);

  if (!isRemotePublishingEnabled(credentials) || credentials?.provider !== "postbridge") {
    return {
      scheduleItemId,
      ok: false,
      reason: "Post Bridge credentials not configured for metrics ingestion",
    };
  }

  const adapter = getMetricsAdapter(item.platform, providerId);
  const fetchResult = await adapter.fetchMetrics(
    {
      remotePostId: item.postiz_post_id,
      postedUrl: item.posted_url,
      platform: item.platform,
      scheduleItemId: item.id,
      videoId: item.video_id,
      projectId: item.project_id,
    },
    { apiKey: credentials.apiKey!, apiUrl: credentials.apiUrl }
  );

  if (!fetchResult.ok) {
    return { scheduleItemId, ok: false, reason: fetchResult.reason };
  }

  const { data: experimentResult } = await admin
    .from("growth_experiment_results")
    .select("id")
    .eq("video_id", item.video_id)
    .maybeSingle();

  try {
    const persisted = await persistMetricsSnapshot(admin, {
      projectId: item.project_id,
      scheduleItemId: item.id,
      videoId: item.video_id,
      growthRunId: item.growth_run_id,
      platform: item.platform,
      remotePostId: item.postiz_post_id,
      snapshot: fetchResult.snapshot,
      growthExperimentResultId: experimentResult?.id ?? null,
    });

    console.info(
      `[metrics-ingestion] ingested schedule_item=${item.id} snapshot=${persisted.snapshotId} source=postbridge`
    );

    return { scheduleItemId, ok: true, snapshotId: persisted.snapshotId };
  } catch (err) {
    return {
      scheduleItemId,
      ok: false,
      reason: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function ingestMetricsForProject(
  projectId: string,
  options?: { sinceDays?: number; ownerId?: string }
): Promise<IngestionRunSummary> {
  const admin = createSupabaseAdminClient();
  const sinceDays = options?.sinceDays ?? DEFAULT_WINDOW_DAYS;
  const summary: IngestionRunSummary = {
    projectId,
    checked: 0,
    ingested: 0,
    skipped: 0,
    errors: [],
  };

  const { data: items, error } = await admin
    .from("schedule_items")
    .select(
      "id, project_id, growth_run_id, video_id, platform, status, postiz_post_id, posted_url, posted_at, scheduled_for"
    )
    .eq("project_id", projectId)
    .eq("status", "posted")
    .not("postiz_post_id", "is", null);

  if (error) {
    summary.errors.push(error.message);
    return summary;
  }

  const eligible = (items ?? []).filter((item) => isWithinMetricsWindow(item, sinceDays));
  summary.checked = eligible.length;

  for (const item of eligible) {
    const result = await ingestMetricsForScheduleItem(item.id, { ownerId: options?.ownerId });
    if (result.ok) {
      summary.ingested++;
    } else {
      summary.skipped++;
      if (result.reason) summary.errors.push(`${item.id}: ${result.reason}`);
    }
  }

  return summary;
}

export { selectEligibleScheduleItems } from "./eligibility";
