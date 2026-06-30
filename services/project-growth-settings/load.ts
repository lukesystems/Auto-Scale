import "server-only";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  ProjectGrowthSettingsSchema,
  type ProjectGrowthSettings,
} from "./schema";
import { ProductionFormatSchema, AudioModeSchema } from "@/services/video-factory/production-options";

const DEFAULTS: Omit<ProjectGrowthSettings, "project_id"> = {
  operation_mode: "manual",
  primary_cta_type: "start_free",
  booking_url: null,
  booking_provider: "none",
  default_cta_label: null,
  default_cta_url: null,
  blocked_topics: [],
  blocked_claims: [],
  blocked_competitors: [],
  distribution_preference: "all_accounts",
  selected_account_ids: [],
  autopilot_enabled: false,
  max_runs_per_day: 1,
  run_cooldown_hours: 24,
  max_active_runs: 1,
  onboarding_completed: false,
  production_format: "slide",
  audio_mode: "voiceover",
};

export async function loadProjectGrowthSettings(
  projectId: string,
  opts?: { useServiceRole?: boolean }
): Promise<ProjectGrowthSettings> {
  const supabase = opts?.useServiceRole
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();
  const { data } = await supabase
    .from("project_growth_settings")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();

  if (!data) {
    return ProjectGrowthSettingsSchema.parse({ project_id: projectId, ...DEFAULTS });
  }

  return ProjectGrowthSettingsSchema.parse({
    project_id: projectId,
    operation_mode: data.operation_mode,
    primary_cta_type: data.primary_cta_type,
    booking_url: data.booking_url,
    booking_provider: data.booking_provider,
    default_cta_label: data.default_cta_label,
    default_cta_url: data.default_cta_url,
    blocked_topics: Array.isArray(data.blocked_topics) ? data.blocked_topics : [],
    blocked_claims: Array.isArray(data.blocked_claims) ? data.blocked_claims : [],
    blocked_competitors: Array.isArray(data.blocked_competitors) ? data.blocked_competitors : [],
    distribution_preference: data.distribution_preference,
    selected_account_ids: Array.isArray(data.selected_account_ids)
      ? (data.selected_account_ids as string[])
      : [],
    autopilot_enabled: data.autopilot_enabled,
    max_runs_per_day: data.max_runs_per_day,
    run_cooldown_hours: data.run_cooldown_hours,
    max_active_runs: data.max_active_runs,
    onboarding_completed: data.onboarding_completed,
    production_format: ProductionFormatSchema.parse(
      (data as { production_format?: string }).production_format ?? "slide"
    ),
    audio_mode: AudioModeSchema.parse(
      (data as { audio_mode?: string }).audio_mode ?? "voiceover"
    ),
  });
}

export async function resolveConnectedAccountIds(
  projectId: string,
  settings: ProjectGrowthSettings,
  opts?: { useServiceRole?: boolean }
): Promise<{ accountIds: string[]; distributionMode: "postiz" | "export_only" }> {
  const supabase = opts?.useServiceRole
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();
  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("id, status")
    .eq("project_id", projectId)
    .eq("status", "active");

  const activeIds = (accounts ?? []).map((a) => a.id);

  if (settings.distribution_preference === "export_only" || activeIds.length === 0) {
    return { accountIds: [], distributionMode: "export_only" };
  }

  if (settings.distribution_preference === "selected") {
    const selected = settings.selected_account_ids.filter((id) => activeIds.includes(id));
    if (!selected.length) {
      return { accountIds: [], distributionMode: "export_only" };
    }
    return { accountIds: selected, distributionMode: "postiz" };
  }

  return { accountIds: activeIds, distributionMode: "postiz" };
}
