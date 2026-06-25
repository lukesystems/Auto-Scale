import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  ProjectGrowthSettingsSchema,
  type ProjectGrowthSettings,
} from "./schema";

export async function upsertProjectGrowthSettings(
  input: Omit<ProjectGrowthSettings, "project_id"> & { project_id: string }
): Promise<void> {
  const parsed = ProjectGrowthSettingsSchema.parse(input);
  const supabase = createSupabaseServerClient();
  const { error } = await supabase.from("project_growth_settings").upsert(
    {
      project_id: parsed.project_id,
      operation_mode: parsed.operation_mode,
      primary_cta_type: parsed.primary_cta_type,
      booking_url: parsed.booking_url ?? null,
      booking_provider: parsed.booking_provider,
      default_cta_label: parsed.default_cta_label ?? null,
      default_cta_url: parsed.default_cta_url ?? null,
      blocked_topics: parsed.blocked_topics as never,
      blocked_claims: parsed.blocked_claims as never,
      blocked_competitors: parsed.blocked_competitors as never,
      distribution_preference: parsed.distribution_preference,
      selected_account_ids: parsed.selected_account_ids as never,
      autopilot_enabled: parsed.autopilot_enabled,
      max_runs_per_day: parsed.max_runs_per_day,
      run_cooldown_hours: parsed.run_cooldown_hours,
      max_active_runs: parsed.max_active_runs,
      onboarding_completed: parsed.onboarding_completed,
    } as never,
    { onConflict: "project_id" }
  );
  if (error) throw new Error(`project_growth_settings upsert: ${error.message}`);
}
