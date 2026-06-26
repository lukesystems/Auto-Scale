import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getProviderModeForUser } from "@/lib/provider-mode";
import {
  getPublishingPostStatus,
  isRemotePublishingEnabled,
  resolvePublishingCredentials,
} from "@/services/social-publishing";

export interface PostizSyncResult {
  checked: number;
  updated: number;
  unknown: number;
  errors: string[];
}

/**
 * Sync schedule_items status from the active publishing provider where possible.
 * When the provider API does not expose post status, marks postiz_status = unknown.
 */
export async function syncPostizScheduleStatus(opts: {
  projectId: string;
  ownerId: string;
  growthRunId?: string;
}): Promise<PostizSyncResult> {
  const admin = createSupabaseAdminClient();
  const mode = await getProviderModeForUser(opts.ownerId);
  const credentials = await resolvePublishingCredentials(opts.ownerId, mode);

  let query = admin
    .from("schedule_items")
    .select("id, video_id, status, postiz_post_id, platform")
    .eq("project_id", opts.projectId)
    .in("status", ["scheduled", "sending", "queued"]);

  if (opts.growthRunId) {
    query = query.eq("growth_run_id", opts.growthRunId);
  }

  const { data: items } = await query;
  const result: PostizSyncResult = { checked: items?.length ?? 0, updated: 0, unknown: 0, errors: [] };

  if (!items?.length) return result;

  if (!isRemotePublishingEnabled(credentials)) {
    for (const item of items) {
      await admin
        .from("schedule_items")
        .update({
          postiz_status: "scheduled_status_unknown",
          postiz_status_synced_at: new Date().toISOString(),
        } as never)
        .eq("id", item.id);
      result.unknown++;
    }
    return result;
  }

  const creds = credentials!;

  for (const item of items) {
    try {
      if (!item.postiz_post_id) {
        await admin
          .from("schedule_items")
          .update({
            postiz_status: "scheduled_status_unknown",
            postiz_status_synced_at: new Date().toISOString(),
          } as never)
          .eq("id", item.id);
        result.unknown++;
        continue;
      }

      const statusResult = await getPublishingPostStatus(creds, item.postiz_post_id);

      if (!statusResult) {
        await admin
          .from("schedule_items")
          .update({
            postiz_status: "scheduled_status_unknown",
            postiz_status_synced_at: new Date().toISOString(),
          } as never)
          .eq("id", item.id);
        result.unknown++;
        continue;
      }

      const remoteStatus = statusResult.status.toLowerCase();

      if (remoteStatus.includes("publish") || remoteStatus.includes("posted") || remoteStatus === "success") {
        await admin
          .from("schedule_items")
          .update({
            status: "posted",
            postiz_status: "posted",
            posted_url: statusResult.postedUrl ?? null,
            postiz_status_synced_at: new Date().toISOString(),
          } as never)
          .eq("id", item.id);
        await admin.from("videos").update({ status: "posted" }).eq("id", item.video_id);
        result.updated++;
      } else if (remoteStatus.includes("fail") || remoteStatus.includes("error")) {
        await admin
          .from("schedule_items")
          .update({
            status: "failed",
            postiz_status: "failed",
            postiz_status_synced_at: new Date().toISOString(),
          } as never)
          .eq("id", item.id);
        result.updated++;
      } else {
        await admin
          .from("schedule_items")
          .update({
            postiz_status: remoteStatus || "scheduled_status_unknown",
            postiz_status_synced_at: new Date().toISOString(),
          } as never)
          .eq("id", item.id);
        result.unknown++;
      }
    } catch (err) {
      result.errors.push(err instanceof Error ? err.message : String(err));
    }
  }

  return result;
}
