"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ProviderMode } from "@/lib/provider-mode";
import { fetchSiteForAutoBrief } from "@/services/autobrief/fetch-site";
import { generateAutoBrief } from "@/services/autobrief/generate";
import { AutoBriefSchema, LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import { createProjectFromAutoBrief } from "@/services/autobrief/create-project";
import { mapAutoBriefError, isAIError, isProviderSetupError } from "@/services/autobrief/map-error";
import { logAIRun } from "@/services/ai/logger";

const ProviderModeSchema = z.enum(["managed", "byok"]);
const UrlSchema = z.string().min(3, "Enter a website URL.");

export type OnboardingActionResult =
  | { ok: true; brief?: z.infer<typeof AutoBriefSchema>; fetchFailed?: boolean; lowConfidence?: boolean }
  | { ok: false; error: string };

export async function saveProviderModeAction(mode: ProviderMode): Promise<OnboardingActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const parsed = ProviderModeSchema.safeParse(mode);
  if (!parsed.success) return { ok: false, error: "Invalid provider mode." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { error } = await supabase.from("user_settings").upsert(
    {
      owner_id: user.id,
      provider_mode: parsed.data,
    },
    { onConflict: "owner_id" }
  );

  if (error) return { ok: false, error: error.message };
  revalidatePath("/onboarding");
  return { ok: true };
}

export async function fetchAndGenerateAutoBriefAction(input: {
  productUrl: string;
  manualProductName?: string;
  manualDescription?: string;
  skipFetch?: boolean;
}): Promise<OnboardingActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const urlParsed = UrlSchema.safeParse(input.productUrl);
  if (!urlParsed.success) return { ok: false, error: urlParsed.error.errors[0]?.message ?? "Invalid URL." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let siteFetch = null;
  let fetchFailed = false;

  if (!input.skipFetch) {
    siteFetch = await fetchSiteForAutoBrief({ url: urlParsed.data });
    if (!siteFetch.ok) fetchFailed = true;
  }

  try {
    const generated = await generateAutoBrief({
      productUrl: urlParsed.data,
      siteFetch,
      manualProductName: input.manualProductName,
      manualDescription: input.manualDescription,
    });

    await logAIRun({
      ownerId: user.id,
      kind: "autobrief",
      provider: generated.provider,
      model: generated.model,
      input: { productUrl: urlParsed.data, fetchFailed },
      rawOutput: generated.raw,
      parsedOutput: generated.brief as never,
      status: "success",
      latencyMs: generated.latencyMs,
    });

    const lowConfidence = generated.brief.confidence_score < LOW_CONFIDENCE_THRESHOLD || fetchFailed;

    return {
      ok: true,
      brief: generated.brief,
      fetchFailed,
      lowConfidence,
    };
  } catch (err) {
    const errorMessage = mapAutoBriefError(err, fetchFailed);

    await logAIRun({
      ownerId: user.id,
      kind: "autobrief",
      provider: isAIError(err) ? err.provider : "unknown",
      model: "unknown",
      input: { productUrl: urlParsed.data, fetchFailed },
      status: "failed",
      errorMessage,
    });

    if (fetchFailed && !isProviderSetupError(err)) {
      return {
        ok: false,
        error: `${errorMessage} Website fetch failed — you can still use manual entry.`,
      };
    }

    return { ok: false, error: errorMessage };
  }
}

export async function confirmAutoBriefAction(input: {
  brief: z.infer<typeof AutoBriefSchema>;
  providerMode: ProviderMode;
}): Promise<OnboardingActionResult & { projectId?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const briefParsed = AutoBriefSchema.safeParse(input.brief);
  if (!briefParsed.success) return { ok: false, error: "Invalid brief data." };

  const modeParsed = ProviderModeSchema.safeParse(input.providerMode);
  if (!modeParsed.success) return { ok: false, error: "Invalid provider mode." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    const { projectId } = await createProjectFromAutoBrief({
      userId: user.id,
      brief: briefParsed.data,
      providerMode: modeParsed.data,
    });

    revalidatePath("/projects");
    revalidatePath("/onboarding");
    redirect(`/projects/${projectId}`);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create project." };
  }
}

export async function skipOnboardingAction(): Promise<never> {
  if (!isSupabaseConfigured()) redirect("/projects");

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  await supabase.from("user_settings").upsert(
    {
      owner_id: user.id,
      onboarding_completed: true,
    },
    { onConflict: "owner_id" }
  );

  redirect("/projects/new");
}
