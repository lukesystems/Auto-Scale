import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

export type ProviderMode = "managed" | "byok";

export interface UserSettingsRow {
  provider_mode: ProviderMode;
  onboarding_completed: boolean;
  preferred_llm_mode: string | null;
  default_project_id: string | null;
}

const DEFAULT_MODE: ProviderMode =
  (process.env.AUTOSCALE_PROVIDER_MODE_DEFAULT as ProviderMode | undefined) === "byok"
    ? "byok"
    : "managed";

export function getDefaultProviderMode(): ProviderMode {
  return DEFAULT_MODE;
}

export function isManagedMode(mode: ProviderMode): boolean {
  return mode === "managed";
}

export function isByokMode(mode: ProviderMode): boolean {
  return mode === "byok";
}

export async function getUserSettings(userId: string): Promise<UserSettingsRow | null> {
  if (!isSupabaseConfigured()) {
    return {
      provider_mode: getDefaultProviderMode(),
      onboarding_completed: false,
      preferred_llm_mode: null,
      default_project_id: null,
    };
  }

  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("user_settings")
    .select("provider_mode, onboarding_completed, preferred_llm_mode, default_project_id")
    .eq("owner_id", userId)
    .maybeSingle();

  if (!data) {
    return {
      provider_mode: getDefaultProviderMode(),
      onboarding_completed: false,
      preferred_llm_mode: null,
      default_project_id: null,
    };
  }

  return {
    provider_mode: (data.provider_mode as ProviderMode) ?? getDefaultProviderMode(),
    onboarding_completed: Boolean(data.onboarding_completed),
    preferred_llm_mode: data.preferred_llm_mode,
    default_project_id: data.default_project_id,
  };
}

export async function getProviderModeForUser(userId: string): Promise<ProviderMode> {
  const settings = await getUserSettings(userId);
  return settings?.provider_mode ?? getDefaultProviderMode();
}

export async function getProviderModeForProject(
  userId: string,
  _projectId?: string
): Promise<ProviderMode> {
  // V1.1: provider mode is user-scoped; project override can be added later.
  return getProviderModeForUser(userId);
}

export async function isOnboardingComplete(userId: string): Promise<boolean> {
  const settings = await getUserSettings(userId);
  return settings?.onboarding_completed ?? false;
}

export async function ensureUserSettings(userId: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  const supabase = createSupabaseServerClient();
  await supabase.from("user_settings").upsert(
    {
      owner_id: userId,
      provider_mode: getDefaultProviderMode(),
      onboarding_completed: false,
    },
    { onConflict: "owner_id", ignoreDuplicates: true }
  );
}
