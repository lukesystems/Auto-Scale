import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { markPhaseStatus, setPhase } from "./repository";
import { GrowthRunOptionsSchema } from "./schema";
import { getUserApprovalPolicy } from "@/lib/user-approval-settings";

type Client = SupabaseClient<Database>;

const STUCK_PRODUCTION_PHASES = new Set(["assets", "videos", "captions"]);
const TERMINAL_JOB_STATUSES = new Set(["ready", "failed", "partial"]);

/**
 * Recover runs stuck at `running` + assets/videos/captions when all videos already
 * reached `ready` (e.g. server action timed out after render finished).
 */
export async function syncStage3RunPhaseIfReady(
  client: Client,
  growthRunId: string,
  ownerId?: string
): Promise<{ synced: boolean; reason: string }> {
  return syncStage3RunPhase(client, growthRunId, ownerId);
}

/**
 * Advance or fail Stage 3 when async render jobs reach a terminal state.
 */
export async function syncStage3RunPhase(
  client: Client,
  growthRunId: string,
  ownerId?: string
): Promise<{ synced: boolean; reason: string }> {
  const ready = await tryFinalizeStage3Ready(client, growthRunId, ownerId);
  if (ready.synced) return ready;
  return tryFinalizeStage3Failed(client, growthRunId, ready.reason);
}

async function tryFinalizeStage3Ready(
  client: Client,
  growthRunId: string,
  ownerId?: string
): Promise<{ synced: boolean; reason: string }> {
  const { data: run } = await client
    .from("growth_runs")
    .select("id, status, phase, options, execution_mode, target_stage")
    .eq("id", growthRunId)
    .maybeSingle();

  if (!run) return { synced: false, reason: "run_not_found" };
  if (run.execution_mode === "stage_only" && run.target_stage !== 3) {
    return { synced: false, reason: "stage_only_not_render" };
  }
  if (run.status !== "running") return { synced: false, reason: `status_${run.status}` };
  if (!run.phase || !STUCK_PRODUCTION_PHASES.has(run.phase)) {
    return { synced: false, reason: `phase_${run.phase ?? "unknown"}` };
  }

  const { data: videos } = await client
    .from("videos")
    .select("id, status")
    .eq("growth_run_id", growthRunId);

  const rows = videos ?? [];
  if (!rows.length) return { synced: false, reason: "no_videos" };
  if (!rows.every((v) => v.status === "ready")) {
    return { synced: false, reason: "videos_not_all_ready" };
  }

  const { data: jobs } = await client
    .from("video_production_jobs")
    .select("status")
    .eq("growth_run_id", growthRunId);
  if ((jobs ?? []).some((j) => j.status === "failed")) {
    return { synced: false, reason: "production_job_failed" };
  }
  if ((jobs ?? []).some((j) => !TERMINAL_JOB_STATUSES.has(j.status))) {
    return { synced: false, reason: "jobs_in_progress" };
  }

  await finalizeStage3Production(client, growthRunId, rows.length, ownerId, run.options);

  return { synced: true, reason: "recovered" };
}

async function tryFinalizeStage3Failed(
  client: Client,
  growthRunId: string,
  priorReason: string
): Promise<{ synced: boolean; reason: string }> {
  const { data: run } = await client
    .from("growth_runs")
    .select("id, status, phase, execution_mode, target_stage")
    .eq("id", growthRunId)
    .maybeSingle();

  if (!run) return { synced: false, reason: "run_not_found" };
  if (run.execution_mode === "stage_only" && run.target_stage !== 3) {
    return { synced: false, reason: "stage_only_not_render" };
  }
  if (run.status !== "running") return { synced: false, reason: `status_${run.status}` };
  if (!run.phase || !STUCK_PRODUCTION_PHASES.has(run.phase)) {
    return { synced: false, reason: `phase_${run.phase ?? "unknown"}` };
  }

  const { data: jobs } = await client
    .from("video_production_jobs")
    .select("status, error")
    .eq("growth_run_id", growthRunId);
  const jobRows = jobs ?? [];
  if (!jobRows.length) return { synced: false, reason: priorReason };

  const pending = jobRows.some((j) => !TERMINAL_JOB_STATUSES.has(j.status));
  if (pending) return { synced: false, reason: "jobs_in_progress" };

  const { data: videos } = await client
    .from("videos")
    .select("id, status")
    .eq("growth_run_id", growthRunId);
  const videoRows = videos ?? [];
  if (!videoRows.length) return { synced: false, reason: "no_videos" };

  const readyCount = videoRows.filter((v) => v.status === "ready").length;
  if (readyCount === videoRows.length) {
    return { synced: false, reason: "videos_ready_pending_sync" };
  }

  const failedJobs = jobRows.filter((j) => j.status === "failed");
  const failedVideos = videoRows.filter((v) => v.status === "failed");
  if (!failedJobs.length && !failedVideos.length) {
    return { synced: false, reason: priorReason };
  }

  const reason =
    failedJobs.find((j) => j.error)?.error ??
    `${Math.max(videoRows.length - readyCount, 0)} video(s) did not reach ready status.`;

  await markPhaseStatus(client, growthRunId, "assets", "failed", {
    rendered: readyCount,
    attempted: videoRows.length,
    failures: failedJobs.length,
    notReady: Math.max(videoRows.length - readyCount, 0),
    error: reason,
  });
  await markPhaseStatus(client, growthRunId, "videos", "failed", {
    count: readyCount,
    attempted: videoRows.length,
  });
  await markPhaseStatus(client, growthRunId, "captions", "skipped", {
    reason: "Video rendering did not complete.",
  });

  await client
    .from("growth_runs")
    .update({
      status: "failed",
      error: reason,
      completed_at: new Date().toISOString(),
    })
    .eq("id", growthRunId);

  return { synced: true, reason: "failed_terminal" };
}

/** Shared tail of Stage 3 orchestration after all videos are ready. */
export async function finalizeStage3Production(
  client: Client,
  growthRunId: string,
  readyCount: number,
  ownerId: string | undefined,
  rawOptions: unknown
): Promise<void> {
  const runOptions = GrowthRunOptionsSchema.partial().parse(
    rawOptions && typeof rawOptions === "object" && !Array.isArray(rawOptions) ? rawOptions : {}
  );

  await markPhaseStatus(client, growthRunId, "assets", "succeeded", {
    failures: 0,
    readyCount,
  });
  await markPhaseStatus(client, growthRunId, "videos", "succeeded", { count: readyCount });
  await markPhaseStatus(client, growthRunId, "captions", "succeeded");

  await setPhase(client, growthRunId, "approval", { status: "awaiting_approval" });

  const approvalPolicy = ownerId
    ? await getUserApprovalPolicy(ownerId)
    : ("ask_at_critical" as const);

  const autoApproveVideos =
    approvalPolicy === "auto_approve_all" || runOptions.approval_mode === "autopilot";

  if (autoApproveVideos) {
    await client
      .from("videos")
      .update({
        status: "approved",
        approval_status: "auto_approved",
        approved_at: new Date().toISOString(),
      })
      .eq("growth_run_id", growthRunId)
      .eq("status", "ready");
  } else if (runOptions.approval_mode === "per_format") {
    await client
      .from("videos")
      .update({
        status: "approved",
        approval_status: "auto_approved",
        approved_at: new Date().toISOString(),
      })
      .eq("growth_run_id", growthRunId)
      .eq("status", "ready")
      .in(
        "concept_id",
        (
          await client
            .from("video_concepts")
            .select("id")
            .eq("growth_run_id", growthRunId)
            .in("video_type", ["slide", "founder_pov", "pain_led"])
        ).data?.map((r) => r.id) ?? []
      );
  }

  await markPhaseStatus(client, growthRunId, "approval", "succeeded");

  await client
    .from("growth_runs")
    .update({
      status: "awaiting_user_input",
      paused_at_phase: "approval",
      phase: "approval",
      current_stage: 3,
    })
    .eq("id", growthRunId);
}
