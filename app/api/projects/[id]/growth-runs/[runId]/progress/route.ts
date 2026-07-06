import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { growthPhaseMessage, GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import { getNextGrowthRunPhase } from "@/lib/growth-run/next-phase";
import { getNextStageCta, getStageByBoundaryPhase } from "@/lib/growth-run/stages";
import { syncStage3RunPhase } from "@/services/growth-run/sync-stage3";
import {
  kickRenderWorker,
  runRenderWorkerUntilIdle,
} from "@/services/video-factory/render-worker";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: run } = await supabase
    .from("growth_runs")
    .select("id, status, phase, phase_status, error, started_at, completed_at, paused_at_phase, current_stage")
    .eq("id", params.runId)
    .eq("project_id", params.id)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ error: "Growth run not found." }, { status: 404 });
  }

  if (run.status === "running" && ["assets", "videos", "captions"].includes(run.phase ?? "")) {
    const { count: pendingJobs } = await supabase
      .from("video_production_jobs")
      .select("id", { count: "exact", head: true })
      .eq("growth_run_id", run.id)
      .eq("status", "queued")
      .eq("current_stage", "awaiting_worker");

    try {
      if ((pendingJobs ?? 0) > 0) {
        kickRenderWorker(run.id);
      } else {
        void runRenderWorkerUntilIdle({ growthRunId: run.id, maxBatches: 1 }).catch(() => undefined);
      }
    } catch {
      // Worker may be unavailable without service role in local dev.
    }

    await syncStage3RunPhase(supabase, run.id, user.id);
    const { data: refreshed } = await supabase
      .from("growth_runs")
      .select("id, status, phase, phase_status, error, started_at, completed_at, paused_at_phase, current_stage")
      .eq("id", params.runId)
      .eq("project_id", params.id)
      .maybeSingle();
    if (refreshed) {
      Object.assign(run, refreshed);
    }
  }

  const phaseStatus = (run.phase_status ?? {}) as Record<string, unknown>;
  let currentMessage = growthPhaseMessage(run.phase ?? "brief", phaseStatus);

  if (run.status === "awaiting_user_input" && run.paused_at_phase) {
    const stage = getStageByBoundaryPhase(run.paused_at_phase);
    if (stage) {
      currentMessage = `Stage ${stage.id} complete — ${getNextStageCta(run.paused_at_phase)}`;
    } else {
      const next = getNextGrowthRunPhase(run.paused_at_phase);
      const nextLabel = next ? GROWTH_RUN_PHASE_LABELS[next] ?? next : "the next step";
      currentMessage = `Paused for your review — continue to start ${nextLabel}`;
    }
  }

  return NextResponse.json({
    growthRunId: run.id,
    status: run.status,
    phase: run.phase,
    phaseStatus,
    currentMessage,
    error: run.error,
    pausedAtPhase: run.paused_at_phase ?? null,
    currentStage: run.current_stage ?? 1,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  });
}
