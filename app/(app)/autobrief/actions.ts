"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getDefaultProviderMode, getUserSettings } from "@/lib/provider-mode";
import { beginAutobriefRun } from "@/services/autobrief/begin-autobrief-run";
import { createProjectFromAutoBrief } from "@/services/autobrief/create-project";
import { AutoBriefSchema, LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import { runUrlToBriefPipeline, type UrlToBriefProfile } from "@/services/autobrief/run-url-to-brief-pipeline";
import { startGrowthRun, GrowthRunExecutionError } from "@/services/growth-run/orchestrator";
import { createGrowthRun } from "@/services/growth-run/repository";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import {
  loadProjectGrowthSettings,
  resolveConnectedAccountIds,
} from "@/services/project-growth-settings/load";
import { resolveProjectCta } from "@/services/project-growth-settings/schema";

export type BeginAutoBriefRunActionResult =
  | { ok: true; projectId: string; crawlId: string; normalizedUrl: string }
  | { ok: false; error: string };

export type ExecuteAutoBriefRunActionResult =
  | {
      ok: true;
      projectId: string;
      brief: z.infer<typeof AutoBriefSchema>;
      fetchFailed?: boolean;
      fetchWarning?: string;
      lowConfidence?: boolean;
    }
  | { ok: false; projectId?: string; error: string };

export type BeginOnboardingGrowthRunResult =
  | { ok: true; growthRunId: string }
  | { ok: false; error: string };

export type ExecuteOnboardingGrowthRunResult =
  | { ok: true; growthRunId: string; status: string }
  | { ok: false; growthRunId?: string; error: string };

const ExecuteSchema = z.object({
  projectId: z.string().uuid(),
  crawlId: z.string().uuid(),
  productUrl: z.string().min(3),
  profile: z.enum(["signup", "project", "refresh"]),
});

async function persistBriefForProject(input: {
  userId: string;
  projectId: string;
  profile: "signup" | "project" | "refresh";
  brief: z.infer<typeof AutoBriefSchema>;
}) {
  const settings = await getUserSettings(input.userId);
  const providerMode = settings?.provider_mode ?? getDefaultProviderMode();

  await createProjectFromAutoBrief({
    userId: input.userId,
    projectId: input.projectId,
    brief: input.brief,
    providerMode,
    touchUserSettings: input.profile === "signup",
  });

  revalidatePath("/projects");
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath("/onboarding");
}

async function buildOnboardingGrowthOptions(projectId: string) {
  const supabase = createSupabaseServerClient();
  const settings = await loadProjectGrowthSettings(projectId);
  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", projectId)
    .maybeSingle();
  const cta = resolveProjectCta(settings, project?.product_url ?? null);
  const { accountIds, distributionMode } = await resolveConnectedAccountIds(projectId, settings);

  const approvalMode: "manual" | "per_format" | "autopilot" =
    settings.operation_mode === "managed"
      ? "autopilot"
      : settings.operation_mode === "assisted"
        ? "per_format"
        : "manual";

  return {
    target_platforms: ["tiktok", "instagram", "youtube"] as Array<"tiktok" | "instagram" | "youtube">,
    approval_mode: approvalMode,
    posting_aggressiveness: "balanced" as const,
    duration_days: 7,
    concept_target_count: 6,
    connected_account_ids: accountIds,
    distribution_mode: distributionMode,
    brand_constraints: {
      primary_cta_label: cta.label,
      primary_cta_url: cta.url,
      cta_intent: cta.intentType,
      booking_warning: cta.setupWarning,
    },
  };
}

export async function beginAutoBriefRunAction(input: {
  productUrl: string;
}): Promise<BeginAutoBriefRunActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  return beginAutobriefRun({ userId: user.id, productUrl: input.productUrl });
}

export async function executeAutoBriefRunAction(
  input: z.infer<typeof ExecuteSchema>
): Promise<ExecuteAutoBriefRunActionResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const parsed = ExecuteSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const { projectId, crawlId, productUrl, profile } = parsed.data;

  const pipeline = await runUrlToBriefPipeline({
    userId: user.id,
    productUrl,
    profile,
    projectId,
    existingCrawlId: crawlId,
  });

  if (!pipeline.ok) {
    return { ok: false, projectId: pipeline.projectId ?? projectId, error: pipeline.error };
  }

  const lowConfidence =
    pipeline.lowConfidence || pipeline.brief.confidence_score < LOW_CONFIDENCE_THRESHOLD;

  if (profile === "signup" || profile === "project") {
    await persistBriefForProject({
      userId: user.id,
      projectId,
      profile,
      brief: pipeline.brief,
    });
  }

  return {
    ok: true,
    projectId,
    brief: pipeline.brief,
    fetchFailed: pipeline.fetchFailed,
    fetchWarning: pipeline.fetchWarning,
    lowConfidence,
  };
}

export async function beginOnboardingGrowthRunAction(input: {
  projectId: string;
}): Promise<BeginOnboardingGrowthRunResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const ffmpeg = checkFfmpegHealth();
  if (!ffmpeg.available) {
    return {
      ok: false,
      error: `${ffmpeg.message}${ffmpeg.fixHint ? ` ${ffmpeg.fixHint}` : ""}`,
    };
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const options = await buildOnboardingGrowthOptions(input.projectId);

  try {
    const run = await createGrowthRun({
      projectId: input.projectId,
      options: options as Record<string, unknown>,
      trigger: "manual",
      approvalMode: options.approval_mode,
      postingAggressiveness: options.posting_aggressiveness,
      targetPlatforms: [...options.target_platforms],
      brandConstraints: options.brand_constraints as Record<string, unknown>,
      distributionMode: options.distribution_mode,
    });

    return { ok: true, growthRunId: run.id };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : "Failed to start Growth Run." };
  }
}

export async function executeOnboardingGrowthRunAction(input: {
  projectId: string;
  growthRunId: string;
}): Promise<ExecuteOnboardingGrowthRunResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const options = await buildOnboardingGrowthOptions(input.projectId);

  try {
    const result = await startGrowthRun({
      projectId: input.projectId,
      ownerId: user.id,
      existingRunId: input.growthRunId,
      trigger: "manual",
      options,
    });

    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath(`/projects/${input.projectId}/growth/${result.growthRunId}`);

    return { ok: true, growthRunId: result.growthRunId, status: result.status };
  } catch (err) {
    if (err instanceof GrowthRunExecutionError) {
      return { ok: false, growthRunId: err.growthRunId, error: err.message };
    }
    return { ok: false, error: err instanceof Error ? err.message : "Growth Run failed." };
  }
}

export async function executeAutoBriefRunForProfile(input: {
  projectId: string;
  crawlId: string;
  productUrl: string;
  profile: UrlToBriefProfile;
}): Promise<ExecuteAutoBriefRunActionResult> {
  if (input.profile === "preview") {
    return { ok: false, error: "Preview profile does not support progress polling." };
  }

  return executeAutoBriefRunAction({
    projectId: input.projectId,
    crawlId: input.crawlId,
    productUrl: input.productUrl,
    profile: input.profile,
  });
}
