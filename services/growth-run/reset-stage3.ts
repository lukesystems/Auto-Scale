import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { markPhaseStatus } from "./repository";

type Client = SupabaseClient<Database>;

const STAGE3_PHASES = ["assets", "videos", "captions", "approval"] as const;

const BLOCKING_SCHEDULE_STATUSES = new Set(["posted", "published", "live"]);

export function canRerunStage3(runStatus: string | null | undefined): boolean {
  if (!runStatus) return false;
  if (runStatus === "running") return false;
  return true;
}

/** Returns an error message when rerun must be blocked, else null. */
export function stage3RerunBlockReason(input: {
  runStatus: string | null | undefined;
  scheduleStatuses: string[];
}): string | null {
  if (!canRerunStage3(input.runStatus)) {
    return "Run is still executing. Wait for it to finish or cancel first.";
  }
  if (input.scheduleStatuses.some((s) => BLOCKING_SCHEDULE_STATUSES.has(s))) {
    return "Cannot rerun Stage 3: one or more videos were already posted.";
  }
  return null;
}

/**
 * Clear Stage 3 artifacts for a growth run. Preserves concepts, scripts,
 * storyboards, and evidence chain upstream.
 */
export async function resetStage3Production(
  client: Client,
  growthRunId: string
): Promise<{ clearedVideoCount: number }> {
  const { data: videos } = await client
    .from("videos")
    .select("id")
    .eq("growth_run_id", growthRunId);
  const videoIds = (videos ?? []).map((v) => v.id);

  if (videoIds.length) {
    const { data: scheduleItems } = await client
      .from("schedule_items")
      .select("id, status")
      .in("video_id", videoIds);

    const posted = (scheduleItems ?? []).filter((s) => BLOCKING_SCHEDULE_STATUSES.has(s.status));
    if (posted.length) {
      throw new Error("Cannot rerun Stage 3: one or more videos were already posted.");
    }

    const deletableScheduleIds = (scheduleItems ?? [])
      .filter((s) => !BLOCKING_SCHEDULE_STATUSES.has(s.status))
      .map((s) => s.id);
    if (deletableScheduleIds.length) {
      await client.from("schedule_items").delete().in("id", deletableScheduleIds);
    }

    await client.from("growth_experiment_results").delete().in("video_id", videoIds);
    await client.from("video_captions").delete().in("video_id", videoIds);
    await client.from("video_quality_scores").delete().in("video_id", videoIds);
  }

  await client.from("generated_assets").delete().eq("growth_run_id", growthRunId);

  if (videoIds.length) {
    await client.from("videos").delete().in("id", videoIds);
  }

  for (const phase of STAGE3_PHASES) {
    await markPhaseStatus(client, growthRunId, phase, "pending");
  }

  await client
    .from("growth_runs")
    .update({
      phase: "storyboards",
      paused_at_phase: null,
      error: null,
      current_stage: 3,
    })
    .eq("id", growthRunId);

  return { clearedVideoCount: videoIds.length };
}
