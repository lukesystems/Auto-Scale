import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

export interface ClassifierThresholds {
  winnerSignupThreshold: number;
  weakCompletionThreshold: number;
  weakClickRateThreshold: number;
  flatViewsThreshold: number;
  /** Saves / views at or above this rate signals conversion intent (Nadia: ~2%). */
  promisingSaveRateThreshold: number;
  /** Saves / views at or above this rate is a strong conversion signal (Nadia: ~3%). */
  strongSaveRateThreshold: number;
}

export const DEFAULT_CLASSIFIER_THRESHOLDS: ClassifierThresholds = {
  winnerSignupThreshold: 3,
  weakCompletionThreshold: 0.35,
  weakClickRateThreshold: 0.005,
  flatViewsThreshold: 500,
  promisingSaveRateThreshold: 0.02,
  strongSaveRateThreshold: 0.03,
};

export async function loadClassifierThresholds(
  supabase: SupabaseClient<Database>,
  projectId: string
): Promise<ClassifierThresholds> {
  const { data } = await supabase
    .from("project_growth_settings")
    .select(
      "winner_signup_threshold, weak_completion_threshold, weak_click_rate_threshold, flat_views_threshold, promising_save_rate_threshold, strong_save_rate_threshold"
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
    promisingSaveRateThreshold: Number(
      data.promising_save_rate_threshold ?? DEFAULT_CLASSIFIER_THRESHOLDS.promisingSaveRateThreshold
    ),
    strongSaveRateThreshold: Number(
      data.strong_save_rate_threshold ?? DEFAULT_CLASSIFIER_THRESHOLDS.strongSaveRateThreshold
    ),
  };
}
