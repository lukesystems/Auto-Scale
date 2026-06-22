import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { sendToPostiz, type PostizCredentials } from "./client";
import { mintTrackedLink, buildTrackedUrl } from "@/services/tracking/links";
import type { Database } from "@/lib/supabase/types";

/**
 * Multi-account scheduler.
 *
 * For a Growth Run with approved videos, fan out one schedule_item per
 * (video × matching connected_account) honoring the posting loadout's
 * cadence and account-health rules:
 *   - max posts per day per account
 *   - minimum interval between posts per account
 *   - no repeated hook within 7 days
 *   - paused / flagged accounts skipped
 *
 * Each schedule_item gets its own tracked_link so attribution stays clean.
 */

export interface MultiAccountScheduleInput {
  growthRunId: string;
  projectId: string;
  ownerId: string;
  baseAppUrl: string;
  destinationUrl: string;
  startAt?: Date;
}

export interface MultiAccountScheduleResult {
  scheduledCount: number;
  skippedCount: number;
  failureCount: number;
  diagnostics: Array<{ videoId: string; accountId: string; outcome: string; reason?: string }>;
}

export async function scheduleApprovedVideos(
  input: MultiAccountScheduleInput
): Promise<MultiAccountScheduleResult> {
  const supabase = createSupabaseServerClient();
  const admin = createSupabaseAdminClient();

  // Approved videos in this run. A video is only schedulable when it has a
  // real rendered final asset — never schedule "captions without a video".
  const { data: candidateVideos, error: vErr } = await supabase
    .from("videos")
    .select(
      "id, concept_id, project_id, growth_run_id, status, approval_status, final_asset_id, duration_seconds, aspect_ratio"
    )
    .eq("growth_run_id", input.growthRunId)
    .in("approval_status", ["approved", "auto_approved"])
    .eq("status", "ready");
  if (vErr) throw new Error(`videos load: ${vErr.message}`);
  if (!candidateVideos?.length) {
    return { scheduledCount: 0, skippedCount: 0, failureCount: 0, diagnostics: [] };
  }

  const diagnostics: MultiAccountScheduleResult["diagnostics"] = [];
  let scheduledCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  // Resolve a real, publicly-fetchable media URL per video. Drop any video
  // whose final asset has not succeeded or has no public URL.
  const videoMedia = new Map<string, string>();
  const videos: typeof candidateVideos = [];
  for (const v of candidateVideos) {
    if (!v.final_asset_id) {
      skippedCount++;
      diagnostics.push({ videoId: v.id, accountId: "n/a", outcome: "skipped", reason: "no final asset" });
      continue;
    }
    const { data: asset } = await supabase
      .from("generated_assets")
      .select("status, public_url")
      .eq("id", v.final_asset_id)
      .maybeSingle();
    if (!asset || asset.status !== "succeeded" || !asset.public_url) {
      skippedCount++;
      diagnostics.push({
        videoId: v.id,
        accountId: "n/a",
        outcome: "skipped",
        reason: "final asset not rendered (status/public_url missing)",
      });
      continue;
    }
    videoMedia.set(v.id, asset.public_url);
    videos.push(v);
  }

  if (!videos.length) {
    return { scheduledCount: 0, skippedCount, failureCount: 0, diagnostics };
  }

  const { data: loadout, error: lErr } = await supabase
    .from("posting_loadouts")
    .select("per_account_plan, duration_days")
    .eq("growth_run_id", input.growthRunId)
    .maybeSingle();
  if (lErr) throw new Error(`loadout load: ${lErr.message}`);
  const perAccountPlan =
    (loadout?.per_account_plan as Array<{
      connected_account_id: string;
      platform: string;
      videos_per_day: number;
    }> | null) ?? [];

  const providerMode = await getProviderModeForUser(input.ownerId);
  const credentials = await resolvePostizCredentials(input.ownerId, providerMode);
  const postizEnabled = !!credentials?.apiKey && !!credentials?.apiUrl;

  const startAt = input.startAt ?? new Date();

  // Per-account counters within this scheduling pass.
  const cursorByAccount = new Map<string, Date>();

  for (const video of videos) {
    const { data: captions } = await supabase
      .from("video_captions")
      .select("id, connected_account_id, platform, caption, hashtags, cta")
      .eq("video_id", video.id);

    if (!captions?.length) {
      diagnostics.push({ videoId: video.id, accountId: "n/a", outcome: "skipped", reason: "no captions" });
      skippedCount++;
      continue;
    }

    for (const caption of captions) {
      const accountId = caption.connected_account_id;
      if (!accountId) continue;

      const { data: account } = await supabase
        .from("connected_accounts")
        .select(
          "id, platform, handle, status, postiz_account_id, max_posts_per_day, min_minutes_between_posts"
        )
        .eq("id", accountId)
        .maybeSingle();
      if (!account || account.status !== "active") {
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "skipped",
          reason: "account inactive",
        });
        skippedCount++;
        continue;
      }
      if (!account.postiz_account_id) {
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "skipped",
          reason: "account not linked to a Postiz integration",
        });
        skippedCount++;
        continue;
      }

      const healthOk = await checkAccountHealth(admin, accountId, input.projectId, video.id);
      if (!healthOk.ok) {
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "skipped",
          reason: healthOk.reason,
        });
        skippedCount++;
        continue;
      }

      const accountPlan = perAccountPlan.find((p) => p.connected_account_id === accountId);
      const perDay = accountPlan?.videos_per_day ?? account.max_posts_per_day;
      const intervalMinutes = Math.max(
        account.min_minutes_between_posts,
        Math.floor((24 * 60) / Math.max(perDay, 1))
      );

      const last = cursorByAccount.get(accountId) ?? startAt;
      const scheduledFor = new Date(Math.max(last.getTime(), startAt.getTime()) + intervalMinutes * 60_000);
      cursorByAccount.set(accountId, scheduledFor);

      const { trackedLinkId, shortCode } = await mintTrackedLink({
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: video.id,
        connectedAccountId: accountId,
        destinationUrl: input.destinationUrl,
        utmSource: account.platform,
        utmContent: `acct_${account.handle}_v_${video.id.slice(0, 8)}`,
      });
      const trackedUrl = buildTrackedUrl({ baseUrl: input.baseAppUrl, shortCode });

      const captionWithLink = `${caption.caption}\n\n${trackedUrl}`;
      const mediaUrl = videoMedia.get(video.id)!;

      const { data: scheduleRow, error: sErr } = await supabase
        .from("schedule_items")
        .insert({
          project_id: input.projectId,
          growth_run_id: input.growthRunId,
          video_id: video.id,
          caption_id: caption.id,
          connected_account_id: accountId,
          platform: caption.platform,
          scheduled_for: scheduledFor.toISOString(),
          status: postizEnabled ? "sending" : "queued",
          postiz_payload: {
            channel: account.postiz_account_id,
            caption: captionWithLink,
            hashtags: caption.hashtags,
            cta: caption.cta,
            media_url: mediaUrl,
            tracked_link_id: trackedLinkId,
            tracked_url: trackedUrl,
          } as never,
        })
        .select("id")
        .single();
      if (sErr) {
        failureCount++;
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "failed",
          reason: `schedule insert: ${sErr.message}`,
        });
        continue;
      }

      // link the tracked_link back to the schedule_item now we have its id
      await supabase
        .from("tracked_links")
        .update({ schedule_item_id: scheduleRow!.id })
        .eq("id", trackedLinkId);

      if (!postizEnabled) {
        scheduledCount++;
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "queued",
          reason: "postiz not configured — queued for export",
        });
        continue;
      }

      const creds: PostizCredentials = {
        apiUrl: credentials!.apiUrl,
        apiKey: credentials!.apiKey,
      };
      const resp = await sendToPostiz(creds, {
        channel: account.postiz_account_id,
        scheduledFor: scheduledFor.toISOString(),
        caption: captionWithLink,
        imageUrls: [mediaUrl],
        cta: caption.cta ?? undefined,
        externalRef: `gr_${input.growthRunId.slice(0, 8)}/v_${video.id.slice(0, 8)}`,
        platform: account.platform,
      });

      if (resp.ok) {
        scheduledCount++;
        await supabase
          .from("schedule_items")
          .update({
            status: "scheduled",
            postiz_post_id: resp.remoteId ?? null,
            postiz_response: (resp.raw ?? {}) as never,
          })
          .eq("id", scheduleRow!.id);
        // The post is scheduled in Postiz, not yet live. Reflect that the
        // video is queued for publishing — do NOT mark it "posted" here.
        await supabase
          .from("videos")
          .update({ status: "approved" })
          .eq("id", video.id);
        diagnostics.push({ videoId: video.id, accountId, outcome: "scheduled" });
      } else {
        failureCount++;
        await supabase
          .from("schedule_items")
          .update({
            status: "failed",
            postiz_response: (resp.raw ?? {}) as never,
            failure_reason: resp.error ?? "postiz unknown error",
          })
          .eq("id", scheduleRow!.id);
        await admin.from("account_health_log").insert({
          connected_account_id: accountId,
          project_id: input.projectId,
          event: "postiz_send_failed",
          severity: "warn",
          metadata: { error: resp.error } as never,
        });
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "failed",
          reason: resp.error ?? "postiz unknown error",
        });
      }
    }
  }

  return { scheduledCount, skippedCount, failureCount, diagnostics };
}

async function checkAccountHealth(
  client: ReturnType<typeof createSupabaseAdminClient>,
  accountId: string,
  projectId: string,
  videoId: string
): Promise<{ ok: true } | { ok: false; reason: string }> {
  // Rule: do not reuse the same hook within 7 days on the same account.
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();
  const { data: targetVideo } = await client
    .from("videos")
    .select("concept_id")
    .eq("id", videoId)
    .single();
  if (!targetVideo?.concept_id) return { ok: true };
  const { data: targetConcept } = await client
    .from("video_concepts")
    .select("hook")
    .eq("id", targetVideo.concept_id)
    .single();
  if (!targetConcept?.hook) return { ok: true };

  const { data: recentSchedules } = await client
    .from("schedule_items")
    .select("video_id")
    .eq("connected_account_id", accountId)
    .eq("project_id", projectId)
    .gte("scheduled_for", sevenDaysAgo)
    .in("status", ["scheduled", "posted", "sending"]);
  const recentVideoIds = (recentSchedules ?? []).map((r) => r.video_id);
  if (!recentVideoIds.length) return { ok: true };

  const { data: recentVideos } = await client
    .from("videos")
    .select("concept_id")
    .in("id", recentVideoIds);
  const recentConceptIds = (recentVideos ?? [])
    .map((v) => v.concept_id)
    .filter((id): id is string => !!id);
  if (!recentConceptIds.length) return { ok: true };

  const { data: recentConcepts } = await client
    .from("video_concepts")
    .select("hook")
    .in("id", recentConceptIds);
  const recentHooks = new Set<string>(
    (recentConcepts ?? []).map((c) => c.hook.toLowerCase())
  );
  if (recentHooks.has(targetConcept.hook.toLowerCase())) {
    return { ok: false, reason: "duplicate hook within 7d on this account" };
  }
  return { ok: true };
}

// Re-exported for callers that don't need to thread Database directly.
export type ScheduleItemRow = Database["public"]["Tables"]["schedule_items"]["Row"];
