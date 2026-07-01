import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  cancelGrowthRunBlockReason,
} from "@/lib/growth-run/cancel-run";

type Client = SupabaseClient<Database>;

export class RunCancelledError extends Error {
  constructor(public readonly growthRunId: string) {
    super("Growth run was cancelled.");
    this.name = "RunCancelledError";
  }
}

export async function throwIfRunCancelled(
  client: Client,
  growthRunId: string
): Promise<void> {
  const { data } = await client
    .from("growth_runs")
    .select("status")
    .eq("id", growthRunId)
    .maybeSingle();

  if (data?.status === "cancelled") {
    throw new RunCancelledError(growthRunId);
  }
}

export async function cancelGrowthRun(input: {
  growthRunId: string;
  projectId?: string;
  client?: Client;
  notes?: string;
}): Promise<{ growthRunId: string; status: "cancelled" }> {
  const client = input.client ?? createSupabaseServerClient();

  let query = client
    .from("growth_runs")
    .select("id, project_id, status")
    .eq("id", input.growthRunId);

  if (input.projectId) {
    query = query.eq("project_id", input.projectId);
  }

  const { data: run, error } = await query.maybeSingle();
  if (error) throw new Error(`growth_runs read failed: ${error.message}`);
  if (!run) throw new Error("Growth run not found.");

  const blockReason = cancelGrowthRunBlockReason(run.status);
  if (blockReason) throw new Error(blockReason);

  const { error: updateError } = await client
    .from("growth_runs")
    .update({
      status: "cancelled",
      paused_at_phase: null,
      completed_at: new Date().toISOString(),
      notes: input.notes ?? "Cancelled by user.",
    })
    .eq("id", input.growthRunId);

  if (updateError) {
    throw new Error(`growth_runs cancel failed: ${updateError.message}`);
  }

  return { growthRunId: input.growthRunId, status: "cancelled" };
}

export {
  canCancelGrowthRun,
  cancelGrowthRunBlockReason,
  CANCELLABLE_RUN_STATUSES,
} from "@/lib/growth-run/cancel-run";
