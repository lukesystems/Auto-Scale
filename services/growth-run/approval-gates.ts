import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  shouldPauseAtPhase,
  type ApprovalGatePhase,
  type ApprovalPolicy,
} from "@/lib/approval-policy";
import { getUserApprovalPolicy } from "@/lib/user-approval-settings";

type Client = SupabaseClient<Database>;

export class RunPausedForApprovalError extends Error {
  constructor(
    public readonly growthRunId: string,
    public readonly phase: ApprovalGatePhase
  ) {
    super(`Run paused for approval at phase: ${phase}`);
    this.name = "RunPausedForApprovalError";
  }
}

export async function maybePauseForUserApproval(input: {
  client: Client;
  growthRunId: string;
  ownerId: string;
  phase: ApprovalGatePhase;
  policy?: ApprovalPolicy;
}): Promise<void> {
  const policy = input.policy ?? (await getUserApprovalPolicy(input.ownerId));

  if (!shouldPauseAtPhase(policy, input.phase)) {
    return;
  }

  await input.client
    .from("growth_runs")
    .update({
      status: "awaiting_user_input",
      paused_at_phase: input.phase,
      phase: input.phase,
    })
    .eq("id", input.growthRunId);

  throw new RunPausedForApprovalError(input.growthRunId, input.phase);
}

export function getNextPhaseAfter(
  current: ApprovalGatePhase | string,
  phases: readonly string[]
): string | null {
  const idx = phases.indexOf(current);
  if (idx === -1) return phases[0] ?? null;
  return phases[idx + 1] ?? null;
}
