import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  GROWTH_RUN_STAGES,
  type GrowthRunStageId,
} from "@/lib/growth-run/stages";

type Client = SupabaseClient<Database>;

export type StagePreconditionResult =
  | { ok: true; parentRunId?: string | null }
  | { ok: false; error: string };

const TERMINAL_RUN_STATUSES = new Set([
  "completed",
  "live",
  "scheduled",
  "awaiting_approval",
  "cancelled",
  "failed",
]);

/** True when the project already has at least one finished or in-progress run. */
export async function projectHasPriorGrowthRuns(
  client: Client,
  projectId: string
): Promise<boolean> {
  const { count } = await client
    .from("growth_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return (count ?? 0) > 0;
}

/** True when the project has a run that reached stage 1 boundary or beyond. */
export async function projectHasRepeatRunEligibility(
  client: Client,
  projectId: string
): Promise<boolean> {
  const { count: completedCount } = await client
    .from("growth_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("status", ["completed", "live", "scheduled", "awaiting_approval"]);

  if ((completedCount ?? 0) > 0) return true;

  const { count: stage1Plus } = await client
    .from("growth_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId)
    .in("paused_at_phase", ["videotrend", "storyboards", "approval", "schedule"]);

  return (stage1Plus ?? 0) > 0;
}

export function getResumePhaseBeforeStage(stage: GrowthRunStageId): string | null {
  const def = GROWTH_RUN_STAGES.find((s) => s.id === stage);
  if (!def) return null;
  const firstPhase = def.phases[0];
  if (!firstPhase) return null;

  const allPhases = GROWTH_RUN_STAGES.flatMap((s) => s.phases);
  const idx = allPhases.indexOf(firstPhase);
  if (idx <= 0) return null;
  return allPhases[idx - 1] ?? null;
}

async function latestRunWithTrendReport(
  client: Client,
  projectId: string,
  excludeRunId?: string
): Promise<string | null> {
  let q = client
    .from("video_trend_reports")
    .select("growth_run_id, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);

  const { data } = await q;
  const row = (data ?? []).find(
    (r) => r.growth_run_id && (!excludeRunId || r.growth_run_id !== excludeRunId)
  );
  return row?.growth_run_id ?? null;
}

async function latestRunWithStoryboardedConcepts(
  client: Client,
  projectId: string,
  excludeRunId?: string
): Promise<string | null> {
  const { data: concepts } = await client
    .from("video_concepts")
    .select("id, growth_run_id")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(40);

  for (const concept of concepts ?? []) {
    if (!concept.growth_run_id || concept.growth_run_id === excludeRunId) continue;
    const { data: script } = await client
      .from("video_scripts")
      .select("id")
      .eq("concept_id", concept.id)
      .maybeSingle();
    const { data: board } = await client
      .from("storyboards")
      .select("id")
      .eq("concept_id", concept.id)
      .maybeSingle();
    if (script && board) return concept.growth_run_id;
  }
  return null;
}

async function latestRunWithApprovedVideos(
  client: Client,
  projectId: string
): Promise<string | null> {
  const { data: videos } = await client
    .from("videos")
    .select("growth_run_id")
    .eq("project_id", projectId)
    .in("approval_status", ["approved", "auto_approved"])
    .order("created_at", { ascending: false })
    .limit(20);

  const runId = videos?.find((v) => v.growth_run_id)?.growth_run_id;
  return runId ?? null;
}

export async function validateStagePreconditions(
  client: Client,
  projectId: string,
  stage: GrowthRunStageId,
  opts?: { growthRunId?: string; productUrl?: string | null }
): Promise<StagePreconditionResult> {
  if (stage === 1) {
    if (!opts?.productUrl?.trim()) {
      const { data: project } = await client
        .from("projects")
        .select("product_url")
        .eq("id", projectId)
        .maybeSingle();
      if (!project?.product_url?.trim()) {
        return {
          ok: false,
          error: "Add a product URL before re-running research.",
        };
      }
    }
    return { ok: true };
  }

  if (stage === 2) {
    const { data: brief } = await client
      .from("product_briefs")
      .select("id")
      .eq("project_id", projectId)
      .maybeSingle();
    if (!brief) {
      return {
        ok: false,
        error: "Product brief missing. Run Stage 1 (Research) first or complete AutoBrief.",
      };
    }

    const { data: onRun } = opts?.growthRunId
      ? await client
          .from("video_trend_reports")
          .select("id")
          .eq("growth_run_id", opts.growthRunId)
          .maybeSingle()
      : { data: null };

    if (onRun) return { ok: true, parentRunId: opts?.growthRunId ?? null };

    const parentRunId = await latestRunWithTrendReport(
      client,
      projectId,
      opts?.growthRunId
    );
    if (!parentRunId) {
      return {
        ok: false,
        error: "Video trend report missing. Run Stage 1 (Research) before strategy & scripts.",
      };
    }
    return { ok: true, parentRunId };
  }

  if (stage === 3) {
    const runId = opts?.growthRunId;
    if (runId) {
      const ready = await runHasStoryboardedConcepts(client, runId);
      if (ready) return { ok: true, parentRunId: runId };
    }

    const parentRunId = await latestRunWithStoryboardedConcepts(
      client,
      projectId,
      runId
    );
    if (!parentRunId) {
      return {
        ok: false,
        error:
          "No concepts with scripts and storyboards. Run Stage 2 before regenerating videos.",
      };
    }
    return { ok: true, parentRunId };
  }

  if (stage === 4) {
    const runId =
      opts?.growthRunId ?? (await latestRunWithApprovedVideos(client, projectId));
    if (!runId) {
      return {
        ok: false,
        error: "No approved videos found. Approve videos in Stage 3 before scheduling.",
      };
    }

    const { data: videos } = await client
      .from("videos")
      .select("id, approval_status")
      .eq("growth_run_id", runId);

    const rows = videos ?? [];
    if (rows.length === 0) {
      return { ok: false, error: "No videos on this run. Generate videos first." };
    }
    const allApproved = rows.every(
      (v) => v.approval_status === "approved" || v.approval_status === "auto_approved"
    );
    if (!allApproved) {
      return {
        ok: false,
        error: "Approve all videos in the production workspace before scheduling.",
      };
    }
    return { ok: true, parentRunId: runId };
  }

  return { ok: false, error: "Invalid stage." };
}

async function runHasStoryboardedConcepts(
  client: Client,
  growthRunId: string
): Promise<boolean> {
  const { data: concepts } = await client
    .from("video_concepts")
    .select("id")
    .eq("growth_run_id", growthRunId);

  if (!concepts?.length) return false;

  for (const concept of concepts) {
    const [{ data: script }, { data: board }] = await Promise.all([
      client.from("video_scripts").select("id").eq("concept_id", concept.id).maybeSingle(),
      client.from("storyboards").select("id").eq("concept_id", concept.id).maybeSingle(),
    ]);
    if (!script || !board) return false;
  }
  return true;
}

export async function loadConceptIdsForStage3(
  client: Client,
  projectId: string,
  growthRunId: string,
  parentRunId?: string | null
): Promise<string[]> {
  const { data: onRun } = await client
    .from("video_concepts")
    .select("id")
    .eq("growth_run_id", growthRunId);

  if (onRun?.length) return onRun.map((r) => r.id);

  const sourceRunId = parentRunId ?? growthRunId;
  const { data: fromParent } = await client
    .from("video_concepts")
    .select("id")
    .eq("growth_run_id", sourceRunId);

  return (fromParent ?? []).map((r) => r.id);
}
