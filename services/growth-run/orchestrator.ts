import "server-only";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  GrowthRunOptionsSchema,
  type GrowthRunOptions,
} from "./schema";
import {
  createGrowthRun,
  markPhaseStatus,
  setPhase,
} from "./repository";
import { runDiscoveryPhase } from "./run-discovery-phase";
import { generateVideoTrendReport } from "@/services/videotrend/generate";
import { generateVideoStrategy } from "@/services/video-strategy/generate";
import { generateVideoConcepts } from "@/services/video-factory/concepts";
import { buildVideosForRun } from "@/services/video-factory";

/**
 * runGrowthRun(): the "Run AutoScale" button.
 *
 * Sequences the closed loop: brief → niche discovery → videotrend → strategy →
 * concepts → scripts → storyboards → assets → videos → captions →
 * awaiting_approval. Posting + tracking + compound run as separate phases
 * after the user (or autopilot) approves the videos.
 *
 * Errors in any phase mark the run failed but persist progress so a retry
 * picks up from the failed phase.
 */

export interface StartGrowthRunInput {
  projectId: string;
  ownerId: string;
  options?: Partial<GrowthRunOptions>;
  trigger?: "manual" | "autopilot" | "scheduled";
  /** Cron/autopilot — bypass RLS with service role. */
  trustedServiceRole?: boolean;
  /** Reuse a row created by beginOnboardingGrowthRun for live progress polling. */
  existingRunId?: string;
}

export interface StartGrowthRunResult {
  growthRunId: string;
  status: string;
  videoIds: string[];
  failures: Array<{ conceptId: string; error: string }>;
}

export class GrowthRunExecutionError extends Error {
  constructor(
    public readonly growthRunId: string,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "GrowthRunExecutionError";
  }
}

export async function startGrowthRun(
  input: StartGrowthRunInput
): Promise<StartGrowthRunResult> {
  const options = GrowthRunOptionsSchema.parse(input.options ?? {});
  const supabase = input.trustedServiceRole
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();

  const run = input.existingRunId
    ? { id: input.existingRunId }
    : await createGrowthRun({
        projectId: input.projectId,
        options,
        trigger: input.trigger ?? "manual",
        approvalMode: options.approval_mode,
        postingAggressiveness: options.posting_aggressiveness,
        targetPlatforms: options.target_platforms,
        brandConstraints: options.brand_constraints,
        distributionMode: options.distribution_mode,
        client: supabase,
      });

  const runId = run.id;

  if (input.existingRunId) {
    await supabase
      .from("growth_runs")
      .update({ status: "running", started_at: new Date().toISOString() })
      .eq("id", runId);
  }
  try {
    await setPhase(supabase, runId, "brief", { status: "running" });
    await markPhaseStatus(supabase, runId, "brief", "succeeded");

    const discovery = await runDiscoveryPhase({
      projectId: input.projectId,
      growthRunId: runId,
      client: supabase,
      onSubPhase: async (phase, status, details) => {
        await setPhase(supabase, runId, phase);
        await markPhaseStatus(supabase, runId, phase, status, details);
      },
    });

    // VideoTrend
    await setPhase(supabase, runId, "videotrend");
    await markPhaseStatus(supabase, runId, "videotrend", "running");
    const { report } = await generateVideoTrendReport({
      projectId: input.projectId,
      growthRunId: runId,
      ownerId: input.ownerId,
      lowConfidenceEvidence: discovery.lowConfidence,
      evidenceCount: discovery.evidenceCount,
    });
    await markPhaseStatus(supabase, runId, "videotrend", "succeeded", {
      confidence: report.confidence,
      structures: report.winning_structures.length,
      lowConfidence: discovery.lowConfidence,
      evidenceCount: discovery.evidenceCount,
    });

    // Strategy + loadout
    await setPhase(supabase, runId, "strategy");
    await markPhaseStatus(supabase, runId, "strategy", "running");
    const { strategy, loadout } = await generateVideoStrategy({
      projectId: input.projectId,
      growthRunId: runId,
      ownerId: input.ownerId,
      trendReport: report,
      options,
    });
    await markPhaseStatus(supabase, runId, "strategy", "succeeded");
    await markPhaseStatus(supabase, runId, "loadout", "succeeded", {
      total: loadout.total_videos_planned,
    });

    // Concepts
    await setPhase(supabase, runId, "concepts");
    await markPhaseStatus(supabase, runId, "concepts", "running");
    const { conceptIds } = await generateVideoConcepts({
      projectId: input.projectId,
      growthRunId: runId,
      ownerId: input.ownerId,
      trendReport: report,
      strategy,
      loadout,
      options,
    });
    await markPhaseStatus(supabase, runId, "concepts", "succeeded", {
      count: conceptIds.length,
    });

    // Scripts → storyboards → assets → videos → captions
    await setPhase(supabase, runId, "videos");
    await markPhaseStatus(supabase, runId, "scripts", "running");
    const { videoIds, failures } = await buildVideosForRun({
      growthRunId: runId,
      projectId: input.projectId,
      conceptIds,
      connectedAccountIds: options.connected_account_ids,
    });
    await markPhaseStatus(supabase, runId, "scripts", "succeeded");
    await markPhaseStatus(supabase, runId, "storyboards", "succeeded");
    await markPhaseStatus(supabase, runId, "assets", "succeeded", { failures: failures.length });
    await markPhaseStatus(supabase, runId, "videos", "succeeded", { count: videoIds.length });
    await markPhaseStatus(supabase, runId, "captions", "succeeded");

    await setPhase(supabase, runId, "approval", { status: "awaiting_approval" });

    // If the run was created in autopilot mode, auto-approve everything and
    // hand off to the scheduling phase. Manual mode stops here for review.
    if (options.approval_mode === "autopilot") {
      await supabase
        .from("videos")
        .update({
          status: "approved",
          approval_status: "auto_approved",
          approved_at: new Date().toISOString(),
        })
        .eq("growth_run_id", runId)
        .in("status", ["rendering", "ready"]);
    } else if (options.approval_mode === "per_format") {
      await supabase
        .from("videos")
        .update({
          status: "approved",
          approval_status: "auto_approved",
          approved_at: new Date().toISOString(),
        })
        .eq("growth_run_id", runId)
        .in(
          "concept_id",
          (
            await supabase
              .from("video_concepts")
              .select("id")
              .eq("growth_run_id", runId)
              .in("video_type", ["slide", "founder_pov", "pain_led"])
          ).data?.map((r) => r.id) ?? []
        );
    }

    return {
      growthRunId: runId,
      status: "awaiting_approval",
      videoIds,
      failures,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    const { data: current } = await supabase
      .from("growth_runs")
      .select("phase, phase_status")
      .eq("id", runId)
      .single();
    const failedPhase = current?.phase ?? "brief";
    const phaseStatus = (current?.phase_status ?? {}) as Record<string, unknown>;
    phaseStatus[failedPhase] = {
      status: "failed",
      at: new Date().toISOString(),
      error: message.slice(0, 2000),
    };
    const { error: failureWriteError } = await supabase
      .from("growth_runs")
      .update({
        status: "failed",
        error: message,
        phase_status: phaseStatus as never,
        completed_at: new Date().toISOString(),
      })
      .eq("id", runId);
    if (failureWriteError) {
      console.error("[growth-run] failed to persist execution error", {
        runId,
        message: failureWriteError.message,
      });
    }
    throw new GrowthRunExecutionError(runId, message, {
      cause: err instanceof Error ? err : undefined,
    });
  }
}
