import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { startGrowthRun } from "@/services/growth-run/orchestrator";
import {
  loadProjectGrowthSettings,
  resolveConnectedAccountIds,
} from "@/services/project-growth-settings/load";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";

export async function logAutopilotDecision(opts: {
  projectId: string;
  growthRunId?: string;
  decisionType: string;
  outcome: string;
  reason?: string;
  metadata?: Record<string, unknown>;
}) {
  const admin = createSupabaseAdminClient();
  await admin.from("autopilot_decision_log").insert({
    project_id: opts.projectId,
    growth_run_id: opts.growthRunId ?? null,
    decision_type: opts.decisionType,
    outcome: opts.outcome,
    reason: opts.reason ?? null,
    metadata: (opts.metadata ?? {}) as never,
  } as never);
}

export async function maybeAutoStartGrowthRun(opts: {
  projectId: string;
  ownerId: string;
}): Promise<{ started: boolean; growthRunId?: string; reason: string }> {
  const admin = createSupabaseAdminClient();
  const settings = await loadProjectGrowthSettings(opts.projectId, { useServiceRole: true });

  if (settings.operation_mode !== "managed" || !settings.autopilot_enabled) {
    return { started: false, reason: "managed mode not enabled" };
  }

  const ffmpeg = checkFfmpegHealth();
  if (!ffmpeg.available) {
    await logAutopilotDecision({
      projectId: opts.projectId,
      decisionType: "auto_start",
      outcome: "skipped",
      reason: ffmpeg.message,
    });
    return { started: false, reason: ffmpeg.message };
  }

  const since = new Date(Date.now() - settings.run_cooldown_hours * 3600_000).toISOString();
  const { count: recentRuns } = await admin
    .from("growth_runs")
    .select("id", { count: "exact", head: true })
    .eq("project_id", opts.projectId)
    .gte("created_at", since);
  if ((recentRuns ?? 0) >= settings.max_runs_per_day) {
    await logAutopilotDecision({
      projectId: opts.projectId,
      decisionType: "auto_start",
      outcome: "skipped",
      reason: "max_runs_per_day reached",
    });
    return { started: false, reason: "cooldown or daily limit" };
  }

  const { data: activeRuns } = await admin
    .from("growth_runs")
    .select("id, status")
    .eq("project_id", opts.projectId)
    .in("status", ["pending", "running", "awaiting_approval", "scheduled", "live"]);
  if ((activeRuns?.length ?? 0) >= settings.max_active_runs) {
    return { started: false, reason: "active run already exists" };
  }

  const { data: brief } = await admin
    .from("product_briefs")
    .select("product_summary")
    .eq("project_id", opts.projectId)
    .maybeSingle();
  if (!brief?.product_summary) {
    await logAutopilotDecision({
      projectId: opts.projectId,
      decisionType: "auto_start",
      outcome: "skipped",
      reason: "product brief incomplete",
    });
    return { started: false, reason: "product brief incomplete" };
  }

  const { accountIds, distributionMode } = await resolveConnectedAccountIds(
    opts.projectId,
    settings,
    { useServiceRole: true }
  );

  const approvalMode =
    settings.operation_mode === "managed"
      ? "autopilot"
      : settings.operation_mode === "assisted"
        ? "per_format"
        : "manual";

  try {
    const result = await startGrowthRun({
      projectId: opts.projectId,
      ownerId: opts.ownerId,
      trigger: "autopilot",
      trustedServiceRole: true,
      options: {
        approval_mode: approvalMode,
        connected_account_ids: accountIds,
        distribution_mode: distributionMode,
        posting_aggressiveness: "conservative",
        concept_target_count: 3,
      },
    });

    await admin
      .from("growth_runs")
      .update({ distribution_mode: distributionMode } as never)
      .eq("id", result.growthRunId);

    await logAutopilotDecision({
      projectId: opts.projectId,
      growthRunId: result.growthRunId,
      decisionType: "auto_start",
      outcome: "started",
      metadata: { distributionMode, accountCount: accountIds.length },
    });

    return { started: true, growthRunId: result.growthRunId, reason: "started" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await logAutopilotDecision({
      projectId: opts.projectId,
      decisionType: "auto_start",
      outcome: "failed",
      reason: message,
    });
    return { started: false, reason: message };
  }
}
