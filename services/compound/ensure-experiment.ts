import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/**
 * Ensure a growth_experiment_results row exists when a video is scheduled/posted.
 * Creates a pending review row if compound has not classified yet.
 */
export async function ensureExperimentResultForVideo(
  supabase: SupabaseClient<Database>,
  opts: {
    projectId: string;
    growthRunId: string;
    videoId: string;
  }
): Promise<string | null> {
  const { data: existing } = await supabase
    .from("growth_experiment_results")
    .select("id")
    .eq("video_id", opts.videoId)
    .maybeSingle();
  if (existing?.id) return existing.id;

  const { data: inserted, error } = await supabase
    .from("growth_experiment_results")
    .insert({
      project_id: opts.projectId,
      growth_run_id: opts.growthRunId,
      video_id: opts.videoId,
      classification: "flat",
      diagnosis: "Scheduled — awaiting metrics for classification.",
      next_action: "review",
      confidence: 0.3,
      metric_summary: { hasSignal: false, pending: true } as never,
    })
    .select("id")
    .single();

  if (error) {
    console.warn("[compound] ensureExperimentResultForVideo failed", error.message);
    return null;
  }
  return inserted?.id ?? null;
}
