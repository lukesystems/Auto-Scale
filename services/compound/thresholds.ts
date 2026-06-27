import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface ClassifierThresholds {
  winnerSignupThreshold: number;
  weakCompletionThreshold: number;
  weakClickRateThreshold: number;
  flatViewsThreshold: number;
}

export const DEFAULT_CLASSIFIER_THRESHOLDS: ClassifierThresholds = {
  winnerSignupThreshold: 3,
  weakCompletionThreshold: 0.35,
  weakClickRateThreshold: 0.005,
  flatViewsThreshold: 500,
};

export async function loadClassifierThresholds(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<ClassifierThresholds> {
  const { data } = await supabase
    .from("project_growth_settings")
    .select(
      "winner_signup_threshold, weak_completion_threshold, weak_click_rate_threshold, flat_views_threshold"
    )
    .eq("project_id", projectId)
    .maybeSingle();

  if (!data) return DEFAULT_CLASSIFIER_THRESHOLDS;

  return {
    winnerSignupThreshold: data.winner_signup_threshold ?? DEFAULT_CLASSIFIER_THRESHOLDS.winnerSignupThreshold,
    weakCompletionThreshold: Number(
      data.weak_completion_threshold ?? DEFAULT_CLASSIFIER_THRESHOLDS.weakCompletionThreshold
    ),
    weakClickRateThreshold: Number(
      data.weak_click_rate_threshold ?? DEFAULT_CLASSIFIER_THRESHOLDS.weakClickRateThreshold
    ),
    flatViewsThreshold: data.flat_views_threshold ?? DEFAULT_CLASSIFIER_THRESHOLDS.flatViewsThreshold,
  };
}
