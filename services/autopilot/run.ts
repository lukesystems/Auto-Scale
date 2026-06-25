import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runCompound } from "@/services/compound/classify";
import { scheduleApprovedVideos } from "@/services/postiz/multi-account";
import { syncPostizScheduleStatus } from "@/services/postiz/sync-status";
import { getManagedProviderConfig } from "@/services/providers/config";
import { loadProjectGrowthSettings } from "@/services/project-growth-settings/load";
import { maybeAutoStartGrowthRun, logAutopilotDecision } from "./start-run";
import { loadVideoQualityScore } from "@/services/video-quality/persist";
import { isSchedulable } from "@/services/video-quality/score";

/**
 * Autopilot tick for one project — managed mode auto-start, auto-approve, auto-schedule.
 */
export async function runAutopilotTick(opts: {
  projectId: string;
  ownerId: string;
}): Promise<{ actions: string[] }> {
  const supabase = createSupabaseAdminClient();
  const actions: string[] = [];
  const settings = await loadProjectGrowthSettings(opts.projectId, { useServiceRole: true });

  // Managed mode: auto-start Growth Runs when eligible.
  if (settings.operation_mode === "managed" && settings.autopilot_enabled) {
    const start = await maybeAutoStartGrowthRun({
      projectId: opts.projectId,
      ownerId: opts.ownerId,
    });
    if (start.started) {
      actions.push(`auto-started growth run ${start.growthRunId?.slice(0, 8)}`);
    } else if (start.reason !== "active run already exists" && start.reason !== "managed mode not enabled") {
      actions.push(`auto-start skipped: ${start.reason}`);
    }
  }

  const { data: latestRun } = await supabase
    .from("growth_runs")
    .select("id, status, approval_mode, distribution_mode")
    .eq("project_id", opts.projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun?.id) return { actions };

  const canAutoApprove =
    settings.operation_mode === "managed" ||
    settings.operation_mode === "assisted" ||
    latestRun.approval_mode === "autopilot" ||
    latestRun.approval_mode === "per_format";

  if (latestRun.status === "awaiting_approval" && canAutoApprove) {
    const { data: readyVideos } = await supabase
      .from("videos")
      .select("id")
      .eq("growth_run_id", latestRun.id)
      .eq("status", "ready");

    let approved = 0;
    for (const v of readyVideos ?? []) {
      const quality = await loadVideoQualityScore(supabase, v.id);
      if (quality && isSchedulable(quality)) {
        await supabase
          .from("videos")
          .update({
            status: "approved",
            approval_status: "auto_approved",
            approved_at: new Date().toISOString(),
          })
          .eq("id", v.id);
        approved++;
      }
    }
    if (approved > 0) {
      actions.push(`auto-approved ${approved} safe video(s)`);
      await logAutopilotDecision({
        projectId: opts.projectId,
        growthRunId: latestRun.id,
        decisionType: "auto_approve",
        outcome: "approved",
        metadata: { count: approved },
      });
    }
  }

  const { data: rules } = await supabase
    .from("autopilot_rules")
    .select("*")
    .eq("project_id", opts.projectId)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  for (const rule of rules ?? []) {
    if (rule.rule_type === "variant_spawn" && latestRun.id) {
      await runCompound({
        projectId: opts.projectId,
        growthRunId: latestRun.id,
        ownerId: opts.ownerId,
        trustedServiceRole: true,
      });
      actions.push("ran compound pass");
    }
  }

  const shouldAutoSchedule =
    settings.operation_mode === "managed" &&
    settings.autopilot_enabled &&
    latestRun.distribution_mode !== "export_only";

  if (
    latestRun.id &&
    (latestRun.status === "awaiting_approval" || latestRun.status === "scheduled") &&
    shouldAutoSchedule
  ) {
    const { data: project } = await supabase
      .from("projects")
      .select("product_url")
      .eq("id", opts.projectId)
      .single();
    const baseAppUrl =
      process.env.AUTOSCALE_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      getManagedProviderConfig().appUrl ??
      "http://localhost:3000";

    const { resolveProjectCta } = await import("@/services/project-growth-settings/schema");
    const cta = resolveProjectCta(settings, project?.product_url ?? null);
    const destinationUrl = cta.url ?? project?.product_url ?? baseAppUrl;

    const schedule = await scheduleApprovedVideos({
      growthRunId: latestRun.id,
      projectId: opts.projectId,
      ownerId: opts.ownerId,
      baseAppUrl,
      destinationUrl,
      intentType: cta.intentType,
      trustedServiceRole: true,
    });
    if (schedule.scheduledCount > 0) {
      await supabase
        .from("growth_runs")
        .update({ status: "live", phase: "live" })
        .eq("id", latestRun.id);
      actions.push(`scheduled ${schedule.scheduledCount} posts via Postiz`);
      await logAutopilotDecision({
        projectId: opts.projectId,
        growthRunId: latestRun.id,
        decisionType: "auto_schedule",
        outcome: "scheduled",
        metadata: { count: schedule.scheduledCount, skipped: schedule.skippedCount },
      });
    } else if (schedule.skippedCount > 0) {
      actions.push(`schedule skipped ${schedule.skippedCount} (see autopilot_skip_log)`);
    }
  }

  const sync = await syncPostizScheduleStatus({
    projectId: opts.projectId,
    ownerId: opts.ownerId,
    growthRunId: latestRun.id,
  });
  if (sync.updated > 0) {
    actions.push(`synced ${sync.updated} Postiz post status(es)`);
  }

  return { actions };
}
