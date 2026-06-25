import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { getProviderModeForUser } from "@/lib/provider-mode";

export interface PostizSyncResult {
  checked: number;
  updated: number;
  unknown: number;
  errors: string[];
}

/**
 * Sync schedule_items status from Postiz where possible.
 * When Postiz API does not expose post status, marks postiz_status = unknown.
 */
export async function syncPostizScheduleStatus(opts: {
  projectId: string;
  ownerId: string;
  growthRunId?: string;
}): Promise<PostizSyncResult> {
  const admin = createSupabaseAdminClient();
  const mode = await getProviderModeForUser(opts.ownerId);
  const credentials = await resolvePostizCredentials(opts.ownerId, mode);

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

  if (!credentials?.apiKey) {
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

      const base = (credentials.apiUrl ?? "https://api.postiz.com").replace(/\/$/, "");
      const url = `${base}/public/v1/posts/${item.postiz_post_id}`;
      const res = await fetch(url, {
        headers: { Authorization: credentials.apiKey },
        signal: AbortSignal.timeout(15_000),
      });

      if (!res.ok) {
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

      const body = (await res.json()) as { status?: string; state?: string; publishedUrl?: string };
      const remoteStatus = (body.status ?? body.state ?? "").toLowerCase();

      if (remoteStatus.includes("publish") || remoteStatus.includes("posted") || remoteStatus === "success") {
        await admin
          .from("schedule_items")
          .update({
            status: "posted",
            postiz_status: "posted",
            posted_url: body.publishedUrl ?? null,
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
