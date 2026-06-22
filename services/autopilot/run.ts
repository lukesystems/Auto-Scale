import "server-only";

import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { runCompound } from "@/services/compound/classify";
import { scheduleApprovedVideos } from "@/services/postiz/multi-account";
import { getManagedProviderConfig } from "@/services/providers/config";

/**
 * Autopilot tick for one project.
 *
 * Rules-driven (not blind AI):
 * - enabled autopilot_rules are evaluated in priority order
 * - generation_volume / posting_cadence rules trigger actions
 * - respects approval_mode on the growth run
 */
export async function runAutopilotTick(opts: {
  projectId: string;
  ownerId: string;
}): Promise<{ actions: string[] }> {
  const supabase = createSupabaseAdminClient();
  const actions: string[] = [];

  const { data: rules } = await supabase
    .from("autopilot_rules")
    .select("*")
    .eq("project_id", opts.projectId)
    .eq("enabled", true)
    .order("priority", { ascending: true });

  const { data: latestRun } = await supabase
    .from("growth_runs")
    .select("id, status, approval_mode")
    .eq("project_id", opts.projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  for (const rule of rules ?? []) {
    const action = rule.action as Record<string, unknown>;
    const trigger = rule.trigger as Record<string, unknown>;

    if (rule.rule_type === "generation_volume" && trigger.on === "schedule") {
      // Growth run generation requires a user session (orchestrator uses RLS client).
      // Cron autopilot logs intent; founders start runs from the UI or a future admin worker.
      actions.push("generation_volume rule noted (start run from UI)");
    }

    if (
      rule.rule_type === "posting_cadence" &&
      latestRun &&
      latestRun.status === "awaiting_approval" &&
      action.auto_approve === true
    ) {
      await supabase
        .from("videos")
        .update({ status: "approved", approval_status: "auto_approved", approved_at: new Date().toISOString() })
        .eq("growth_run_id", latestRun.id)
        .eq("status", "ready");
      actions.push("auto-approved ready videos");
    }

    if (rule.rule_type === "variant_spawn" && latestRun?.id) {
      await runCompound({
        projectId: opts.projectId,
        growthRunId: latestRun.id,
        ownerId: opts.ownerId,
        trustedServiceRole: true,
      });
      actions.push("ran compound pass");
    }
  }

  if (latestRun?.id && latestRun.status === "awaiting_approval") {
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
    const schedule = await scheduleApprovedVideos({
      growthRunId: latestRun.id,
      projectId: opts.projectId,
      ownerId: opts.ownerId,
      baseAppUrl,
      destinationUrl: project?.product_url ?? baseAppUrl,
      trustedServiceRole: true,
    });
    if (schedule.scheduledCount > 0) {
      actions.push(`scheduled ${schedule.scheduledCount} posts via Postiz`);
    }
  }

  return { actions };
}
