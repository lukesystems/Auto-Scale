"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { beginAutobriefRun } from "@/services/autobrief/begin-autobrief-run";
import { createGrowthRun } from "@/services/growth-run/repository";
import {
  startGrowthRun,
  resumeGrowthRun,
  rejectGrowthRunPhase,
  GrowthRunExecutionError,
} from "@/services/growth-run/orchestrator";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import {
  loadProjectGrowthSettings,
  resolveConnectedAccountIds,
} from "@/services/project-growth-settings/load";
import { resolveProjectCta } from "@/services/project-growth-settings/schema";
import { getDefaultCuratedModel } from "@/services/ai/curated-models";

const ModelSchema = z.object({
  slug: z.string().min(1),
  source: z.enum(["curated", "advanced"]),
});

const BeginUnifiedSchema = z.object({
  productUrl: z.string().min(3),
  aiModel: ModelSchema,
  profile: z.enum(["signup", "project"]).default("project"),
});

export type BeginUnifiedRunResult =
  | { ok: true; projectId: string; crawlId: string; growthRunId: string; normalizedUrl: string }
  | { ok: false; error: string };

export type ExecuteUnifiedRunResult =
  | { ok: true; projectId: string; growthRunId: string; status: string; pausedAtPhase?: string }
  | { ok: false; projectId?: string; growthRunId?: string; error: string };

async function buildUnifiedGrowthOptions(projectId: string) {
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
    target_platforms: ["tiktok", "instagram", "youtube"] as Array<
      "tiktok" | "instagram" | "youtube"
    >,
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

export async function beginUnifiedRunAction(
  input: z.infer<typeof BeginUnifiedSchema>
): Promise<BeginUnifiedRunResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const parsed = BeginUnifiedSchema.safeParse(input);
  if (!parsed.success) return { ok: false, error: "Invalid input." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const model = parsed.data.aiModel.slug || getDefaultCuratedModel().slug;

  const begun = await beginAutobriefRun({
    userId: user.id,
    productUrl: parsed.data.productUrl,
    aiModelSlug: model,
    aiModelSource: parsed.data.aiModel.source,
  });
  if (!begun.ok) return { ok: false, error: begun.error };

  const options = await buildUnifiedGrowthOptions(begun.projectId);

  try {
    const run = await createGrowthRun({
      projectId: begun.projectId,
      options: {
        ...options,
        unified: true,
        product_url: begun.normalizedUrl,
        crawl_id: begun.crawlId,
      } as Record<string, unknown>,
      trigger: "manual",
      approvalMode: options.approval_mode,
      postingAggressiveness: options.posting_aggressiveness,
      targetPlatforms: [...options.target_platforms],
      brandConstraints: options.brand_constraints as Record<string, unknown>,
      distributionMode: options.distribution_mode,
    });

    return {
      ok: true,
      projectId: begun.projectId,
      crawlId: begun.crawlId,
      growthRunId: run.id,
      normalizedUrl: begun.normalizedUrl,
    };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to start unified run.",
    };
  }
}

export async function executeUnifiedRunAction(input: {
  projectId: string;
  growthRunId: string;
  productUrl: string;
  crawlId: string;
  profile?: "signup" | "project";
}): Promise<ExecuteUnifiedRunResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const ffmpeg = checkFfmpegHealth();
  if (!ffmpeg.available) {
    console.warn("[unified-run] ffmpeg unavailable:", ffmpeg.message);
  }

  const options = await buildUnifiedGrowthOptions(input.projectId);

  try {
    const result = await startGrowthRun({
      projectId: input.projectId,
      ownerId: user.id,
      existingRunId: input.growthRunId,
      unified: true,
      productUrl: input.productUrl,
      crawlId: input.crawlId,
      profile: input.profile ?? "project",
      options,
    });

    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath(`/projects/${input.projectId}/growth/${result.growthRunId}`);
    revalidatePath("/projects");
    revalidatePath("/onboarding");

    return {
      ok: true,
      projectId: input.projectId,
      growthRunId: result.growthRunId,
      status: result.status,
      pausedAtPhase: result.pausedAtPhase,
    };
  } catch (err) {
    if (err instanceof GrowthRunExecutionError) {
      return {
        ok: false,
        projectId: input.projectId,
        growthRunId: err.growthRunId,
        error: err.message,
      };
    }
    return {
      ok: false,
      projectId: input.projectId,
      error: err instanceof Error ? err.message : "Unified run failed.",
    };
  }
}

export async function resumeGrowthRunAction(input: {
  projectId: string;
  growthRunId: string;
}): Promise<ExecuteUnifiedRunResult> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  try {
    const result = await resumeGrowthRun({
      growthRunId: input.growthRunId,
      ownerId: user.id,
    });

    revalidatePath(`/projects/${input.projectId}`);
    revalidatePath(`/projects/${input.projectId}/growth/${input.growthRunId}`);

    return {
      ok: true,
      projectId: input.projectId,
      growthRunId: result.growthRunId,
      status: result.status,
      pausedAtPhase: result.pausedAtPhase,
    };
  } catch (err) {
    return {
      ok: false,
      projectId: input.projectId,
      growthRunId: input.growthRunId,
      error: err instanceof Error ? err.message : "Failed to resume run.",
    };
  }
}

export async function rejectGrowthRunPhaseAction(input: {
  projectId: string;
  growthRunId: string;
}): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured()) return { ok: false, error: "Supabase not configured." };

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: "Not signed in." };

  await rejectGrowthRunPhase({ growthRunId: input.growthRunId });
  revalidatePath(`/projects/${input.projectId}`);
  revalidatePath(`/projects/${input.projectId}/growth/${input.growthRunId}`);
  return { ok: true };
}
