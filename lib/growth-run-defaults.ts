import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface GrowthRunFormDefaults {
  targetPlatforms: Array<"tiktok" | "instagram" | "youtube">;
  approvalMode: "manual" | "per_format" | "autopilot";
  postingAggressiveness: "conservative" | "balanced" | "aggressive";
  durationDays: number;
  formatHypothesisCount: number;
}

const FALLBACK: GrowthRunFormDefaults = {
  targetPlatforms: ["tiktok", "instagram", "youtube"],
  approvalMode: "manual",
  postingAggressiveness: "balanced",
  durationDays: 7,
  formatHypothesisCount: 2,
};

export async function loadGrowthRunFormDefaults(
  projectId: string
): Promise<GrowthRunFormDefaults> {
  const supabase = createSupabaseServerClient();
  const { data: lastRun } = await supabase
    .from("growth_runs")
    .select("id, options, approval_mode, posting_aggressiveness, target_platforms")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!lastRun) return FALLBACK;

  const options = (lastRun.options ?? {}) as Record<string, unknown>;
  const loadout = lastRun.id
    ? (
        await supabase
          .from("posting_loadouts")
          .select("total_videos_planned")
          .eq("growth_run_id", lastRun.id)
          .maybeSingle()
      ).data
    : null;

  const platforms = Array.isArray(lastRun.target_platforms)
    ? (lastRun.target_platforms as string[]).filter((p): p is "tiktok" | "instagram" | "youtube" =>
        ["tiktok", "instagram", "youtube"].includes(p)
      )
    : FALLBACK.targetPlatforms;

  const conceptTarget =
    typeof options.concept_target_count === "number" ? options.concept_target_count : null;
  const formatHypothesisCount =
    conceptTarget != null ? (conceptTarget >= 6 ? 2 : 1) : loadout?.total_videos_planned
      ? Math.min(2, Math.max(1, Math.ceil((loadout.total_videos_planned ?? 6) / 3)))
      : FALLBACK.formatHypothesisCount;

  return {
    targetPlatforms: platforms.length ? platforms : FALLBACK.targetPlatforms,
    approvalMode: lastRun.approval_mode ?? FALLBACK.approvalMode,
    postingAggressiveness: lastRun.posting_aggressiveness ?? FALLBACK.postingAggressiveness,
    durationDays:
      typeof options.duration_days === "number" ? options.duration_days : FALLBACK.durationDays,
    formatHypothesisCount,
  };
}
