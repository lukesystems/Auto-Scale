import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  getStageByBoundaryPhase,
  type GrowthRunStageId,
} from "@/lib/growth-run/stages";
import { RunPausedForApprovalError } from "./approval-gates";

type Client = SupabaseClient<Database>;

/**
 * Mandatory macro-stage boundary — always pauses regardless of approval policy.
 * Stage transitions require an explicit user CTA.
 */
export async function maybePauseAtStageBoundary(input: {
  client: Client;
  growthRunId: string;
  stage: GrowthRunStageId;
  boundaryPhase: string;
}): Promise<void> {
  const stageDef = getStageByBoundaryPhase(input.boundaryPhase);
  if (!stageDef || stageDef.id !== input.stage) {
    throw new Error(`Invalid stage boundary: stage ${input.stage} / ${input.boundaryPhase}`);
  }

  await input.client
    .from("growth_runs")
    .update({
      status: "awaiting_user_input",
      paused_at_phase: input.boundaryPhase,
      phase: input.boundaryPhase as Database["public"]["Tables"]["growth_runs"]["Row"]["phase"],
      current_stage: input.stage,
    })
    .eq("id", input.growthRunId);

  throw new RunPausedForApprovalError(
    input.growthRunId,
    input.boundaryPhase as never
  );
}
