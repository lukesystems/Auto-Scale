"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { ProviderMode } from "@/lib/provider-mode";
import { createBriefGeneratingProject, createProjectFromAutoBrief } from "@/services/autobrief/create-project";
import { AutoBriefSchema, LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import {
  parseProductUrl,
  runUrlToBriefPipeline,
} from "@/services/autobrief/run-url-to-brief-pipeline";

const ProviderModeSchema = z.enum(["managed", "byok"]);

export type OnboardingActionResult =
  | {
      ok: true;
      projectId?: string;
      brief?: z.infer<typeof AutoBriefSchema>;
      fetchFailed?: boolean;
      fetchWarning?: string;
      lowConfidence?: boolean;
    }
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
}): Promise<OnboardingActionResult> {
  try {
    return await fetchAndGenerateAutoBriefActionImpl(input);
  } catch (err) {
    console.error("[onboarding] fetchAndGenerateAutoBriefAction failed", err);
    return {
      ok: false,
      error: err instanceof Error ? err.message : "AutoBrief generation failed unexpectedly.",
    };
  }
}

async function fetchAndGenerateAutoBriefActionImpl(input: {
  productUrl: string;
}): Promise<OnboardingActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const urlParsed = parseProductUrl(input.productUrl);
  if (!urlParsed.ok) return { ok: false, error: urlParsed.error };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  let projectId: string;
  try {
    const project = await createBriefGeneratingProject({
      userId: user.id,
      productUrl: urlParsed.url,
    });
    projectId = project.projectId;
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to create project." };
  }

  const pipeline = await runUrlToBriefPipeline({
    userId: user.id,
    productUrl: input.productUrl,
    profile: "signup",
    projectId,
  });

  if (!pipeline.ok) {
    return { ok: false, projectId: pipeline.projectId ?? projectId, error: pipeline.error };
  }

  const lowConfidence =
    pipeline.lowConfidence || pipeline.brief.confidence_score < LOW_CONFIDENCE_THRESHOLD;

  return {
    ok: true,
    projectId,
    brief: pipeline.brief,
    fetchFailed: pipeline.fetchFailed,
    fetchWarning: pipeline.fetchWarning,
    lowConfidence,
  };
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

  let savedProjectId: string;
  try {
    const { projectId } = await createProjectFromAutoBrief({
      userId: user.id,
      projectId: projectParsed.data,
      brief: briefParsed.data,
      providerMode: modeParsed.data,
    });
    savedProjectId = projectId;

    revalidatePath("/projects");
    revalidatePath(`/projects/${projectId}`);
    revalidatePath("/onboarding");
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to save product brief." };
  }

  redirect(`/projects/${savedProjectId}`);
}
