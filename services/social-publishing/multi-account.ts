import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { getProviderModeForUser } from "@/lib/provider-mode";
import {
  getPublishingProviderId,
  isRemotePublishingEnabled,
  resolvePublishingCredentials,
  schedulePostViaProvider,
} from "@/services/social-publishing";
import { mintTrackedLink, buildTrackedUrl } from "@/services/tracking/links";
import type { Database } from "@/lib/supabase/types";
import { loadVideoQualityScore } from "@/services/video-quality/persist";
import { isSchedulable, MIN_SCHEDULE_QUALITY_SCORE } from "@/services/video-quality/score";
import { logAutopilotSkip } from "./skip-log";
import { getPlatformVariantUrl } from "@/services/video-factory/platform-variants";
import { nativeSoundNote } from "@/services/audio/library";
import { ensureExperimentResultForVideo } from "@/services/compound/ensure-experiment";

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
  /** Use service-role client (cron/autopilot — no user session). */
  trustedServiceRole?: boolean;
  /** Configurable duplicate-hook window in days (default 7). */
  duplicateHookWindowDays?: number;
  /** Configurable duplicate-format window in days (default 3). */
  duplicateFormatWindowDays?: number;
  /** Build preview only; no inserts or provider calls. */
  previewOnly?: boolean;
  intentType?: "product" | "demo_intent" | "lead_intent";
}

export interface MultiAccountScheduleResult {
  scheduledCount: number;
  skippedCount: number;
  failureCount: number;
  diagnostics: Array<{ videoId: string; accountId: string; outcome: string; reason?: string }>;
  preview: Array<{
    videoId: string;
    accountId: string;
    platform: string;
    scheduledFor: string;
    hook: string;
    mediaUrl: string;
    qualityScore: number | null;
    caption?: string;
    ctaLabel?: string;
    trackedUrl?: string;
    duplicateWarning?: string | null;
    formatWarning?: string | null;
    audioNote?: string;
    qualityBlocked?: boolean;
    blockReason?: string | null;
  }>;
}

export async function scheduleApprovedVideos(
  input: MultiAccountScheduleInput
): Promise<MultiAccountScheduleResult> {
  const supabase = input.trustedServiceRole
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();
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
    return { scheduledCount: 0, skippedCount: 0, failureCount: 0, diagnostics: [], preview: [] };
  }

  const diagnostics: MultiAccountScheduleResult["diagnostics"] = [];
  const preview: MultiAccountScheduleResult["preview"] = [];
  let scheduledCount = 0;
  let skippedCount = 0;
  let failureCount = 0;

  // Resolve a real, publicly-fetchable media URL per video. Drop any video
  // whose final asset has not succeeded or has no public URL.
  const videoMedia = new Map<string, string>();
  const videos: typeof candidateVideos = [];
  for (const v of candidateVideos) {
    if (v.status === "failed") {
      skippedCount++;
      diagnostics.push({ videoId: v.id, accountId: "n/a", outcome: "skipped", reason: "render failed" });
      await logAutopilotSkip(admin, {
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: v.id,
        reason: "render_failed",
      });
      continue;
    }
    if (!v.final_asset_id) {
      skippedCount++;
      diagnostics.push({ videoId: v.id, accountId: "n/a", outcome: "skipped", reason: "no final asset" });
      await logAutopilotSkip(admin, {
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: v.id,
        reason: "no_final_mp4",
      });
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
      await logAutopilotSkip(admin, {
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: v.id,
        reason: "video_not_ready",
        details: { asset_status: asset?.status ?? null },
      });
      continue;
    }

    const quality = await loadVideoQualityScore(supabase, v.id);
    if (quality && !isSchedulable(quality)) {
      skippedCount++;
      diagnostics.push({
        videoId: v.id,
        accountId: "n/a",
        outcome: "skipped",
        reason: quality.block_reason ?? `quality score ${quality.overall_score} below ${MIN_SCHEDULE_QUALITY_SCORE}`,
      });
      await logAutopilotSkip(admin, {
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: v.id,
        reason: "quality_score_too_low",
        details: { overall_score: quality.overall_score, block_reason: quality.block_reason },
      });
      continue;
    }
    videoMedia.set(v.id, asset.public_url);
    videos.push(v);
  }

  if (!videos.length) {
    return { scheduledCount: 0, skippedCount, failureCount: 0, diagnostics, preview };
  }

  const previewOnly = input.previewOnly === true;

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
  const credentials = await resolvePublishingCredentials(input.ownerId, providerMode);
  const remotePublishing = isRemotePublishingEnabled(credentials);
  if (!remotePublishing) {
    await logAutopilotSkip(admin, {
      projectId: input.projectId,
      growthRunId: input.growthRunId,
      reason: "postbridge_missing",
      details: { note: "Post Bridge credentials are missing." },
    });
  }

  const hookWindowDays = input.duplicateHookWindowDays ?? 7;
  const formatWindowDays = input.duplicateFormatWindowDays ?? 3;
  const startAt = input.startAt ?? new Date();
  const cursorByAccount = new Map<string, Date>();

  for (const video of videos) {
    const { data: captions } = await supabase
      .from("video_captions")
      .select("id, connected_account_id, platform, caption, hashtags, cta")
      .eq("video_id", video.id);

    if (!captions?.length) {
      diagnostics.push({ videoId: video.id, accountId: "n/a", outcome: "skipped", reason: "no captions" });
      skippedCount++;
      await logAutopilotSkip(admin, {
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: video.id,
        reason: "no_connected_account",
        details: { note: "No captions — connect accounts for this platform" },
      });
      continue;
    }

    const { data: conceptRow } = await supabase
      .from("video_concepts")
      .select("hook, video_type, production_mode")
      .eq("id", video.concept_id)
      .maybeSingle();
    const videoQuality = await loadVideoQualityScore(supabase, video.id);

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
        await logAutopilotSkip(admin, {
          projectId: input.projectId,
          growthRunId: input.growthRunId,
          videoId: video.id,
          connectedAccountId: accountId,
          reason: account?.status === "paused" ? "account_health_paused" : "no_connected_account",
        });
        continue;
      }
      if (!account.postiz_account_id) {
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "skipped",
          reason: "account not linked to a publishing provider",
        });
        skippedCount++;
        continue;
      }

      const healthOk = await checkAccountHealth(admin, {
        accountId,
        projectId: input.projectId,
        videoId: video.id,
        hookWindowDays,
        formatWindowDays,
        videoType: conceptRow?.video_type ?? null,
        productionMode: conceptRow?.production_mode ?? null,
      });
      if (!healthOk.ok) {
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "skipped",
          reason: healthOk.reason,
        });
        skippedCount++;
        await logAutopilotSkip(admin, {
          projectId: input.projectId,
          growthRunId: input.growthRunId,
          videoId: video.id,
          connectedAccountId: accountId,
          reason: healthOk.reason.includes("format")
            ? "duplicate_format_risk"
            : "duplicate_hook_risk",
          details: { reason: healthOk.reason },
        });
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

      const variantUrl =
        (await getPlatformVariantUrl(supabase, video.id, caption.platform)) ??
        videoMedia.get(video.id)!;
      const mediaUrl = variantUrl;

      const duplicateWarning = null;
      const formatWarning = null;

      const trackedUrl = previewOnly
        ? `${input.baseAppUrl.replace(/\/$/, "")}/r/preview`
        : buildTrackedUrl({
            baseUrl: input.baseAppUrl,
            shortCode: (
              await mintTrackedLink({
                projectId: input.projectId,
                growthRunId: input.growthRunId,
                videoId: video.id,
                connectedAccountId: accountId,
                destinationUrl: input.destinationUrl,
                intentType: input.intentType ?? "product",
                utmSource: account.platform,
                utmContent: `acct_${account.handle}_v_${video.id.slice(0, 8)}`,
              })
            ).shortCode,
          });

      const captionWithLink = `${caption.caption}\n\n${trackedUrl}`;

      preview.push({
        videoId: video.id,
        accountId,
        platform: caption.platform,
        scheduledFor: scheduledFor.toISOString(),
        hook: conceptRow?.hook ?? "",
        mediaUrl,
        qualityScore: videoQuality?.overall_score ?? null,
        caption: captionWithLink,
        ctaLabel: caption.cta ?? undefined,
        trackedUrl,
        duplicateWarning,
        formatWarning,
        audioNote: nativeSoundNote(caption.platform),
        qualityBlocked: videoQuality ? !isSchedulable(videoQuality) : false,
        blockReason: videoQuality?.block_reason ?? null,
      });

      if (previewOnly) {
        scheduledCount++;
        continue;
      }

      const { trackedLinkId, shortCode } = await mintTrackedLink({
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: video.id,
        connectedAccountId: accountId,
        destinationUrl: input.destinationUrl,
        intentType: input.intentType ?? "product",
        utmSource: account.platform,
        utmContent: `acct_${account.handle}_v_${video.id.slice(0, 8)}`,
      });
      const liveTrackedUrl = buildTrackedUrl({ baseUrl: input.baseAppUrl, shortCode });
      const liveCaptionWithLink = `${caption.caption}\n\n${liveTrackedUrl}`;

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
          status: remotePublishing ? "sending" : "queued",
          postiz_payload: {
            channel: account.postiz_account_id,
            caption: liveCaptionWithLink,
            hashtags: caption.hashtags,
            cta: caption.cta,
            media_url: mediaUrl,
            tracked_link_id: trackedLinkId,
            tracked_url: liveTrackedUrl,
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

      await ensureExperimentResultForVideo(supabase, {
        projectId: input.projectId,
        growthRunId: input.growthRunId,
        videoId: video.id,
      });

      // link the tracked_link back to the schedule_item now we have its id
      await supabase
        .from("tracked_links")
        .update({ schedule_item_id: scheduleRow!.id })
        .eq("id", trackedLinkId);

      if (!remotePublishing) {
        failureCount++;
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "failed",
          reason: "Post Bridge is not configured",
        });
        continue;
      }

      const resp = await schedulePostViaProvider(credentials!, {
        accountId: account.postiz_account_id,
        scheduledFor: scheduledFor.toISOString(),
        caption: liveCaptionWithLink,
        mediaUrls: [mediaUrl],
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
        // The post is scheduled remotely, not yet live. Reflect that the
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
            failure_reason: resp.error ?? "Post Bridge unknown error",
          })
          .eq("id", scheduleRow!.id);
        await admin.from("account_health_log").insert({
          connected_account_id: accountId,
          project_id: input.projectId,
          event: "postbridge_send_failed",
          severity: "warn",
          metadata: { error: resp.error } as never,
        });
        diagnostics.push({
          videoId: video.id,
          accountId,
          outcome: "failed",
          reason: resp.error ?? "Post Bridge unknown error",
        });
      }
    }
  }

  return { scheduledCount, skippedCount, failureCount, diagnostics, preview };
}

async function checkAccountHealth(
  client: ReturnType<typeof createSupabaseAdminClient>,
  opts: {
    accountId: string;
    projectId: string;
    videoId: string;
    hookWindowDays: number;
    formatWindowDays: number;
    videoType: string | null;
    productionMode: string | null;
  }
): Promise<{ ok: true } | { ok: false; reason: string }> {
  const hookSince = new Date(Date.now() - opts.hookWindowDays * 24 * 60 * 60 * 1000).toISOString();
  const formatSince = new Date(Date.now() - opts.formatWindowDays * 24 * 60 * 60 * 1000).toISOString();
  const { data: targetVideo } = await client
    .from("videos")
    .select("concept_id")
    .eq("id", opts.videoId)
    .single();
  if (!targetVideo?.concept_id) return { ok: true };
  const { data: targetConcept } = await client
    .from("video_concepts")
    .select("hook, video_type, production_mode")
    .eq("id", targetVideo.concept_id)
    .single();
  if (!targetConcept?.hook) return { ok: true };

  const { data: recentSchedules } = await client
    .from("schedule_items")
    .select("video_id")
    .eq("connected_account_id", opts.accountId)
    .eq("project_id", opts.projectId)
    .gte("scheduled_for", hookSince)
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
    .select("hook, video_type, production_mode")
    .in("id", recentConceptIds);
  const recentHooks = new Set<string>(
    (recentConcepts ?? []).map((c) => c.hook.toLowerCase())
  );
  if (recentHooks.has(targetConcept.hook.toLowerCase())) {
    return { ok: false, reason: `duplicate hook within ${opts.hookWindowDays}d on this account` };
  }

  const targetFormat = targetConcept.production_mode ?? targetConcept.video_type;
  const recentFormats = new Set(
    (recentConcepts ?? []).map((c) => (c.production_mode ?? c.video_type).toLowerCase())
  );
  const { data: formatSchedules } = await client
    .from("schedule_items")
    .select("video_id")
    .eq("connected_account_id", opts.accountId)
    .eq("project_id", opts.projectId)
    .gte("scheduled_for", formatSince)
    .in("status", ["scheduled", "posted", "sending"]);
  if ((formatSchedules?.length ?? 0) >= 2 && recentFormats.has(targetFormat.toLowerCase())) {
    return {
      ok: false,
      reason: `duplicate format (${targetFormat}) posted too tightly on this account`,
    };
  }

  return { ok: true };
}

// Re-exported for callers that don't need to thread Database directly.
export type ScheduleItemRow = Database["public"]["Tables"]["schedule_items"]["Row"];
