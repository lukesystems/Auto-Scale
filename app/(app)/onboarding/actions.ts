"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ProviderMode } from "@/lib/provider-mode";
import { fetchSiteForAutoBrief, normalizeProductUrl, type SiteFetchOutput } from "@/services/autobrief/fetch-site";
import { generateAutoBrief } from "@/services/autobrief/generate";
import { AutoBriefSchema, LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import { createBriefGeneratingProject, createProjectFromAutoBrief } from "@/services/autobrief/create-project";
import { mapAutoBriefError, isAIError, isProviderSetupError } from "@/services/autobrief/map-error";
import { logAIRun } from "@/services/ai/logger";

const ProviderModeSchema = z.enum(["managed", "byok"]);
const UrlSchema = z.string().min(3, "Enter a website URL.");

export type OnboardingActionResult =
  | { ok: true; projectId?: string; brief?: z.infer<typeof AutoBriefSchema>; fetchFailed?: boolean; lowConfidence?: boolean }
  | { ok: false; projectId?: string; error: string };

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

  let normalizedUrl: string;
  try {
    normalizedUrl = normalizeProductUrl(urlParsed.data);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Invalid URL." };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let projectId: string;
  try {
    const project = await createBriefGeneratingProject({
      userId: user.id,
      productUrl: normalizedUrl,
      productName: input.manualProductName,
    });
    projectId = project.projectId;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create project." };
  }

  let siteFetch: SiteFetchOutput | null = null;
  let fetchFailed = false;

  if (!input.skipFetch) {
    try {
      siteFetch = await fetchSiteForAutoBrief({ url: normalizedUrl });
      if (!siteFetch.ok) fetchFailed = true;
    } catch (err) {
      fetchFailed = true;
      siteFetch = {
        ok: false,
        url: normalizedUrl,
        finalUrl: null,
        title: null,
        description: null,
        textSnippet: null,
        pages: [],
        error: err instanceof Error ? err.message : "Website fetch failed.",
      };
    }
  }

  const hasManualFallback = Boolean(input.manualDescription?.trim() || input.manualProductName?.trim());
  if (input.skipFetch && !hasManualFallback) {
    const error = "Paste homepage copy or describe your product before using manual entry.";
    await supabase
      .from("projects")
      .update({ status: "brief_failed", description: error })
      .eq("id", projectId);
    return { ok: false, projectId, error };
  }

  if (fetchFailed && !hasManualFallback) {
    const error = siteFetch?.error
      ? `We could not read this website: ${siteFetch.error}. Paste your homepage copy or describe your product manually.`
      : "We could not read this website. Paste your homepage copy or describe your product manually.";
    await supabase
      .from("projects")
      .update({ status: "brief_failed", description: error })
      .eq("id", projectId);
    return { ok: false, projectId, error };
  }

  try {
    const generated = await generateAutoBrief({
      productUrl: normalizedUrl,
      siteFetch,
      manualProductName: input.manualProductName,
      manualDescription: input.manualDescription,
    });

    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "autobrief",
      provider: generated.provider,
      model: generated.model,
      input: { productUrl: normalizedUrl, fetchFailed, pagesRead: siteFetch?.pages.length ?? 0 },
      rawOutput: generated.raw,
      parsedOutput: generated.brief as never,
      status: "success",
      latencyMs: generated.latencyMs,
    });

    const lowConfidence = generated.brief.confidence_score < LOW_CONFIDENCE_THRESHOLD || fetchFailed;

    return {
      ok: true,
      projectId,
      brief: generated.brief,
      fetchFailed,
      lowConfidence,
    };
  } catch (err) {
    const errorMessage = mapAutoBriefError(err, fetchFailed);

    await logAIRun({
      ownerId: user.id,
      projectId,
      kind: "autobrief",
      provider: isAIError(err) ? err.provider : "unknown",
      model: "unknown",
      input: { productUrl: normalizedUrl, fetchFailed, pagesRead: siteFetch?.pages.length ?? 0 },
      status: "failed",
      errorMessage,
    });

    await supabase
      .from("projects")
      .update({ status: "brief_failed", description: errorMessage })
      .eq("id", projectId);

    if (fetchFailed && !isProviderSetupError(err)) {
      return {
        ok: false,
        projectId,
        error: `${errorMessage} Website fetch failed; paste homepage copy or describe your product manually.`,
      };
    }

    return { ok: false, projectId, error: errorMessage };
  }
}

export async function confirmAutoBriefAction(input: {
  projectId: string;
  brief: z.infer<typeof AutoBriefSchema>;
  providerMode: ProviderMode;
}): Promise<OnboardingActionResult & { projectId?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const projectParsed = z.string().uuid().safeParse(input.projectId);
  if (!projectParsed.success) return { ok: false, error: "Missing project ID." };

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
      projectId: projectParsed.data,
      brief: briefParsed.data,
      providerMode: modeParsed.data,
    });

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/onboarding");
    redirect(`/projects/${projectId}`);
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save product brief." };
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
