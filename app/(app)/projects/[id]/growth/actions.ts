"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseAdminClient, createSupabaseServerClient, requireUser } from "@/lib/supabase/server";
import {
  buildManualMetricsSnapshot,
  persistMetricsSnapshot,
} from "@/services/metrics-ingestion/persist";
import {
  continueGrowthRunStage,
  rejectGrowthRunPhase,
  rerunGrowthRunStage3,
  runGrowthRunStage,
  runGrowthRunStageOnly,
  startGrowthRun,
  finalizeStageOnlyRun,
} from "@/services/growth-run/orchestrator";
import { cancelGrowthRun } from "@/services/growth-run/cancel-run";
import { syncStage3RunPhase } from "@/services/growth-run/sync-stage3";
import {
  projectHasRepeatRunEligibility,
  validateStagePreconditions,
} from "@/lib/growth-run/stage-preconditions";
import type { GrowthRunStageId } from "@/lib/growth-run/stages";
import { createGrowthRun } from "@/services/growth-run/repository";
import { scheduleApprovedVideos } from "@/services/social-publishing/multi-account";
import { runCompound } from "@/services/compound/classify";
import {
  reviseHook,
  reviseSceneText,
  regenerateSceneVisual,
  regenerateVoiceoverWithResult,
  rerenderVideo,
} from "@/services/video-revision";
import { validateSilentVoiceoverForSchedule } from "@/lib/schedule-guard";
import { GrowthRunOptionsSchema } from "@/services/growth-run/schema";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { getManagedProviderConfig } from "@/services/providers/config";
import { syncProjectConnectedAccounts } from "@/services/social-publishing";
import {
  loadProjectGrowthSettings,
  resolveConnectedAccountIds,
} from "@/services/project-growth-settings/load";
import { resolveProjectCta } from "@/services/project-growth-settings/schema";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import {
  ProductionFormatSchema,
  AudioModeSchema,
  FalRenderModeSchema,
  FalModelTierSchema,
  VisualPipelineSchema,
  VideoOutputModeSchema,
  QualityTierSchema,
  resolveProductionOptions,
  DEFAULT_PRODUCTION_QUALITY_OPTIONS,
  coerceFallbackOnBadAiScene,
} from "@/services/video-factory/production-options";
import { isFalConfigured } from "@/services/media/fal-config";

function parseGrowthRunOptions(raw: unknown) {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return GrowthRunOptionsSchema.partial().parse(raw);
  }
  return {};
}

async function loadVoiceoverAssetForConcept(conceptId: string) {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("generated_assets")
    .select("metadata")
    .eq("concept_id", conceptId)
    .eq("kind", "voiceover")
    .maybeSingle();
  return data;
}

async function assertVoiceoverSchedulable(opts: {
  growthRunId: string;
  conceptId: string;
  userConfirmedOverride?: boolean;
}) {
  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select("options")
    .eq("id", opts.growthRunId)
    .maybeSingle();
  const runOptions = parseGrowthRunOptions(run?.options);
  const voiceover = await loadVoiceoverAssetForConcept(opts.conceptId);
  const guard = validateSilentVoiceoverForSchedule(
    voiceover
      ? {
          metadata:
            voiceover.metadata && typeof voiceover.metadata === "object" && !Array.isArray(voiceover.metadata)
              ? (voiceover.metadata as Record<string, unknown>)
              : null,
        }
      : null,
    {
      allowSilentVoiceover: runOptions.allow_silent_voiceover === true,
      userConfirmedOverride: opts.userConfirmedOverride,
    }
  );
  if (!guard.ok) throw new Error(guard.error);
}

const StartRunSchema = z.object({
  projectId: z.string().uuid(),
  targetPlatforms: z
    .array(z.enum(["tiktok", "instagram", "youtube"]))
    .min(1)
    .default(["tiktok"]),
  approvalMode: z.enum(["manual", "per_format", "autopilot"]).optional(),
  postingAggressiveness: z
    .enum(["conservative", "balanced", "aggressive"])
    .default("conservative"),
  durationDays: z.coerce.number().int().min(1).max(60).default(1),
  formatHypothesisCount: z.coerce.number().int().min(1).max(2).default(1),
  productionFormat: ProductionFormatSchema.optional(),
  audioMode: AudioModeSchema.optional(),
  visualPipeline: z.union([VisualPipelineSchema, z.literal("auto")]).optional(),
  distributionPreference: z
    .enum(["all_accounts", "selected"])
    .optional(),
  selectedAccountIds: z.array(z.string().uuid()).optional(),
});

async function buildGrowthRunStartContext(
  projectId: string,
  parsed: z.infer<typeof StartRunSchema>
) {
  const supabase = createSupabaseServerClient();
  const settings = await loadProjectGrowthSettings(projectId);
  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", projectId)
    .single();
  const cta = resolveProjectCta(settings, project?.product_url ?? null);

  const distPref =
    parsed.distributionPreference ?? settings.distribution_preference;
  const accountSettings = {
    ...settings,
    distribution_preference: distPref,
    selected_account_ids:
      parsed.selectedAccountIds ?? settings.selected_account_ids,
  };
  const { accountIds, distributionMode } = await resolveConnectedAccountIds(
    projectId,
    accountSettings
  );

  const approvalMode =
    parsed.approvalMode ??
    (settings.operation_mode === "managed"
      ? "autopilot"
      : settings.operation_mode === "assisted"
        ? "per_format"
        : "manual");

  const growthOptions = {
    target_platforms: parsed.targetPlatforms,
    approval_mode: approvalMode,
    posting_aggressiveness: parsed.postingAggressiveness,
    duration_days: parsed.durationDays,
    concept_target_count: parsed.formatHypothesisCount * 3,
    connected_account_ids: accountIds,
    distribution_mode: distributionMode,
    production_format: parsed.productionFormat ?? settings.production_format,
    audio_mode: parsed.audioMode ?? settings.audio_mode,
    ...(parsed.visualPipeline && parsed.visualPipeline !== "auto"
      ? { visual_pipeline: parsed.visualPipeline }
      : {}),
    brand_constraints: {
      primary_cta_label: cta.label,
      primary_cta_url: cta.url,
      cta_intent: cta.intentType,
      booking_warning: cta.setupWarning,
    },
  };

  return {
    growthOptions,
    approvalMode,
    postingAggressiveness: parsed.postingAggressiveness,
    targetPlatforms: parsed.targetPlatforms,
    brandConstraints: growthOptions.brand_constraints,
    distributionMode,
  };
}

export async function startGrowthRunAction(formData: FormData) {
  const user = await requireUser();
  const parsed = StartRunSchema.safeParse({
    projectId: formData.get("projectId"),
    targetPlatforms: formData.getAll("targetPlatforms").filter(Boolean),
    approvalMode: formData.get("approvalMode") ?? undefined,
    postingAggressiveness: formData.get("postingAggressiveness") ?? undefined,
    durationDays: formData.get("durationDays") ?? undefined,
    formatHypothesisCount: formData.get("formatHypothesisCount") ?? undefined,
    productionFormat: formData.get("productionFormat") ?? undefined,
    audioMode: formData.get("audioMode") ?? undefined,
    visualPipeline: formData.get("visualPipeline") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const supabase = createSupabaseServerClient();
  const ctx = await buildGrowthRunStartContext(parsed.data.projectId, parsed.data);
  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", parsed.data.projectId)
    .single();

  const run = await createGrowthRun({
    projectId: parsed.data.projectId,
    options: {
      ...ctx.growthOptions,
      unified: true,
      product_url: project?.product_url ?? undefined,
      unified_profile: "project",
    } as Record<string, unknown>,
    trigger: "manual",
    approvalMode: ctx.approvalMode,
    postingAggressiveness: ctx.postingAggressiveness,
    targetPlatforms: ctx.targetPlatforms,
    brandConstraints: ctx.brandConstraints as Record<string, unknown>,
    distributionMode: ctx.distributionMode,
  });

  revalidatePath(`/projects/${parsed.data.projectId}/growth`);
  redirect(`/projects/${parsed.data.projectId}/growth/${run.id}?autoExecute=1`);
}

const ExecuteRunSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export type ExecuteGrowthRunResult =
  | {
      ok: true;
      growthRunId: string;
      status: string;
      pausedAtPhase?: string;
      skipped?: boolean;
    }
  | { ok: false; growthRunId?: string; error: string };

export async function executeGrowthRunAction(
  input: z.infer<typeof ExecuteRunSchema>
): Promise<ExecuteGrowthRunResult> {
  const user = await requireUser();
  const parsed = ExecuteRunSchema.parse(input);

  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select("options, status, execution_mode, target_stage")
    .eq("id", parsed.growthRunId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();

  if (!run) {
    return { ok: false, error: "Growth run not found." };
  }

  if (run.status === "cancelled") {
    return {
      ok: true,
      growthRunId: parsed.growthRunId,
      status: run.status,
      skipped: true,
    };
  }

  if (run.status !== "pending") {
    return {
      ok: true,
      growthRunId: parsed.growthRunId,
      status: run.status,
      skipped: true,
    };
  }

  const rawOptions =
    run.options && typeof run.options === "object" && !Array.isArray(run.options)
      ? (run.options as Record<string, unknown>)
      : {};
  const stored = parseGrowthRunOptions(run.options);
  const unified = rawOptions.unified === true;
  const productUrl =
    typeof rawOptions.product_url === "string" ? rawOptions.product_url : undefined;
  const crawlId =
    typeof rawOptions.crawl_id === "string" ? rawOptions.crawl_id : null;
  const profile =
    rawOptions.unified_profile === "signup" || rawOptions.unified_profile === "project"
      ? rawOptions.unified_profile
      : "project";
  const options = GrowthRunOptionsSchema.partial().parse(stored);

  const executionMode =
    (run as { execution_mode?: string }).execution_mode ?? "sequential_first";
  const targetStage = (run as { target_stage?: number | null }).target_stage as
    | GrowthRunStageId
    | null
    | undefined;

  try {
    const result =
      executionMode === "stage_only" && targetStage
        ? await runGrowthRunStage({
            growthRunId: parsed.growthRunId,
            ownerId: user.id,
            stage: targetStage,
          })
        : await startGrowthRun({
            projectId: parsed.projectId,
            ownerId: user.id,
            existingRunId: parsed.growthRunId,
            unified,
            productUrl,
            crawlId,
            profile: unified ? profile : undefined,
            options,
          });

    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${result.growthRunId}`);

    return {
      ok: true,
      growthRunId: result.growthRunId,
      status: result.status,
      pausedAtPhase: result.pausedAtPhase,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as { name?: unknown }).name === "GrowthRunExecutionError" &&
      typeof (error as { growthRunId?: unknown }).growthRunId === "string"
    ) {
      const growthRunId = (error as { growthRunId: string }).growthRunId;
      revalidatePath(`/projects/${parsed.projectId}/growth/${growthRunId}`);
      return {
        ok: true,
        growthRunId,
        status: "failed",
      };
    }

    return {
      ok: false,
      growthRunId: parsed.growthRunId,
      error: error instanceof Error ? error.message : "Growth run failed.",
    };
  }
}

const ScheduleSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export async function scheduleRunAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = ScheduleSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
  });
  const confirmSilentOverride = formData.get("confirmSilentOverride") === "on";

  const supabase = createSupabaseServerClient();
  const { data: approvedVideos } = await supabase
    .from("videos")
    .select("id, concept_id")
    .eq("growth_run_id", parsed.growthRunId)
    .in("approval_status", ["approved", "auto_approved"])
    .eq("status", "ready");

  for (const video of approvedVideos ?? []) {
    if (!video.concept_id) continue;
    await assertVoiceoverSchedulable({
      growthRunId: parsed.growthRunId,
      conceptId: video.concept_id,
      userConfirmedOverride: confirmSilentOverride,
    });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", parsed.projectId)
    .single();
  const settings = await loadProjectGrowthSettings(parsed.projectId);
  const cta = resolveProjectCta(settings, project?.product_url ?? null);
  const destinationUrl = cta.url ?? project?.product_url ?? getManagedProviderConfig().appUrl ?? "https://example.com";

  const baseAppUrl =
    process.env.AUTOSCALE_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    getManagedProviderConfig().appUrl ??
    "http://localhost:3000";

  await scheduleApprovedVideos({
    growthRunId: parsed.growthRunId,
    projectId: parsed.projectId,
    ownerId: user.id,
    baseAppUrl,
    destinationUrl,
    intentType: cta.intentType,
  });

  await supabase
    .from("growth_runs")
    .update({ status: "live", phase: "live" })
    .eq("id", parsed.growthRunId);

  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

const ApproveSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  decision: z.enum(["approve", "reject", "kill"]),
});

export async function decideVideoAction(formData: FormData) {
  const user = await requireUser();
  const parsed = ApproveSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
    videoId: formData.get("videoId"),
    decision: formData.get("decision"),
  });
  const confirmSilentOverride = formData.get("confirmSilentOverride") === "on";
  const supabase = createSupabaseServerClient();

  if (parsed.decision === "approve") {
    const { data: video } = await supabase
      .from("videos")
      .select("concept_id")
      .eq("id", parsed.videoId)
      .maybeSingle();
    if (video?.concept_id) {
      await assertVoiceoverSchedulable({
        growthRunId: parsed.growthRunId,
        conceptId: video.concept_id,
        userConfirmedOverride: confirmSilentOverride,
      });
    }
  }

  const patch =
    parsed.decision === "approve"
      ? {
          status: "approved" as const,
          approval_status: "approved" as const,
          approved_by: user.id,
          approved_at: new Date().toISOString(),
        }
      : parsed.decision === "reject"
        ? { status: "rejected" as const, approval_status: "rejected" as const }
        : { status: "killed" as const, approval_status: "rejected" as const };
  await supabase
    .from("videos")
    .update(patch)
    .eq("id", parsed.videoId)
    .eq("growth_run_id", parsed.growthRunId);
  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

const MetricSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  scheduleItemId: z.string().uuid(),
  videoId: z.string().uuid(),
  views: z.coerce.number().int().nonnegative().optional(),
  likes: z.coerce.number().int().nonnegative().optional(),
  comments: z.coerce.number().int().nonnegative().optional(),
  shares: z.coerce.number().int().nonnegative().optional(),
  saves: z.coerce.number().int().nonnegative().optional(),
  completionRate: z.coerce.number().min(0).max(1).optional(),
  linkClicks: z.coerce.number().int().nonnegative().optional(),
  signups: z.coerce.number().int().nonnegative().optional(),
});

export async function recordMetricsAction(formData: FormData) {
  await requireUser();
  const parsed = MetricSchema.parse(Object.fromEntries(formData.entries()));
  const supabase = createSupabaseServerClient();

  const { data: scheduleItem } = await supabase
    .from("schedule_items")
    .select("platform")
    .eq("id", parsed.scheduleItemId)
    .maybeSingle();

  const snapshot = buildManualMetricsSnapshot({
    views: parsed.views,
    likes: parsed.likes,
    comments: parsed.comments,
    shares: parsed.shares,
    saves: parsed.saves,
    completionRate: parsed.completionRate,
    linkClicks: parsed.linkClicks,
    signups: parsed.signups,
  });

  const admin = createSupabaseAdminClient();
  await persistMetricsSnapshot(admin, {
    projectId: parsed.projectId,
    scheduleItemId: parsed.scheduleItemId,
    videoId: parsed.videoId,
    growthRunId: parsed.growthRunId,
    platform: scheduleItem?.platform ?? "tiktok",
    snapshot,
    linkClicks: parsed.linkClicks ?? null,
    signups: parsed.signups ?? null,
    completionRate: parsed.completionRate ?? null,
  });

  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

const CompoundSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export async function runCompoundAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = CompoundSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
  });
  await runCompound({
    projectId: parsed.projectId,
    growthRunId: parsed.growthRunId,
    ownerId: user.id,
  });
  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

const SyncAccountsSchema = z.object({
  projectId: z.string().uuid(),
});

export async function syncPublishingAccountsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = SyncAccountsSchema.parse({ projectId: formData.get("projectId") });
  const mode = await getProviderModeForUser(user.id);
  await syncProjectConnectedAccounts({
    projectId: parsed.projectId,
    userId: user.id,
    providerMode: mode,
  });
  revalidatePath(`/projects/${parsed.projectId}/growth`);
}

const ReviseHookSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  conceptId: z.string().uuid(),
  newHook: z.string().min(3).max(500),
});

export async function reviseHookAction(formData: FormData) {
  await requireUser();
  const parsed = ReviseHookSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
    videoId: formData.get("videoId"),
    conceptId: formData.get("conceptId"),
    newHook: formData.get("newHook"),
  });
  await reviseHook(parsed);
  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

const ReviseSceneSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  sceneId: z.string().uuid(),
  voiceoverText: z.string().optional(),
  overlayText: z.string().optional(),
  subtitleText: z.string().optional(),
});

export async function reviseSceneTextAction(formData: FormData) {
  await requireUser();
  const parsed = ReviseSceneSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
    sceneId: formData.get("sceneId"),
    voiceoverText: formData.get("voiceoverText") || undefined,
    overlayText: formData.get("overlayText") || undefined,
    subtitleText: formData.get("subtitleText") || undefined,
  });
  await reviseSceneText(parsed);
  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

const RegenSceneSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  conceptId: z.string().uuid(),
  sceneId: z.string().uuid(),
});

export async function regenerateSceneVisualAction(formData: FormData) {
  await requireUser();
  const parsed = RegenSceneSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
    videoId: formData.get("videoId"),
    conceptId: formData.get("conceptId"),
    sceneId: formData.get("sceneId"),
  });
  await regenerateSceneVisual(parsed);
  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

const RerenderSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid(),
  conceptId: z.string().uuid(),
});

export async function rerenderVideoAction(formData: FormData) {
  await requireUser();
  const parsed = RerenderSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
    videoId: formData.get("videoId"),
    conceptId: formData.get("conceptId"),
  });
  await rerenderVideo(parsed);
  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

/** Alias for spec naming */
export const reRenderConceptAction = rerenderVideoAction;

const RegenerateVoiceoverSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  videoId: z.string().uuid().optional(),
  conceptId: z.string().uuid().optional(),
});

export async function regenerateVoiceoverAction(formData: FormData) {
  await requireUser();
  const parsed = RegenerateVoiceoverSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
    videoId: formData.get("videoId") || undefined,
    conceptId: formData.get("conceptId") || undefined,
  });

  const result = await regenerateVoiceoverWithResult({
    projectId: parsed.projectId,
    videoId: parsed.videoId,
    conceptId: parsed.conceptId,
  });

  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);

  if (!result.ok) {
    return { ok: false as const, error: result.error };
  }

  return {
    ok: true as const,
    provider: result.provider,
    isSilent: result.isSilent,
    publicUrl: result.publicUrl,
    attemptLog: result.attemptLog,
    reassembled: result.reassembled,
  };
}

export async function regenerateVoiceoverFormAction(formData: FormData): Promise<void> {
  const result = await regenerateVoiceoverAction(formData);
  if (!result.ok) throw new Error(result.error);
}

/** Alias for spec naming */
export const reSynthesizeVoiceoverAction = regenerateVoiceoverAction;

/** Alias for spec naming */
export const approveVideoForScheduleAction = decideVideoAction;
export const rejectVideoAction = decideVideoAction;

const AcknowledgeLowEvidenceSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export async function acknowledgeLowEvidenceAction(formData: FormData) {
  await requireUser();
  const parsed = AcknowledgeLowEvidenceSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
  });
  const supabase = createSupabaseServerClient();
  const { data: runRow } = await supabase
    .from("growth_runs")
    .select("options")
    .eq("id", parsed.growthRunId)
    .single();
  const existing =
    runRow?.options && typeof runRow.options === "object" && !Array.isArray(runRow.options)
      ? (runRow.options as Record<string, unknown>)
      : {};
  await supabase
    .from("growth_runs")
    .update({
      options: { ...existing, low_evidence_acknowledged: true },
    })
    .eq("id", parsed.growthRunId);
  revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
}

export async function continueStage3ToScheduleAction(formData: FormData) {
  const user = await requireUser();
  const parsed = AcknowledgeLowEvidenceSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
  });

  const supabase = createSupabaseServerClient();
  await syncStage3RunPhase(supabase, parsed.growthRunId, user.id);

  try {
    await continueGrowthRunStage({
      growthRunId: parsed.growthRunId,
      ownerId: user.id,
    });
  } finally {
    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
  }
}

const ReferenceUrlSchema = z.object({
  projectId: z.string().uuid(),
  url: z.string().url(),
  platform: z.enum(["tiktok", "instagram", "youtube"]).optional(),
});

export async function importReferenceVideoAction(formData: FormData) {
  await requireUser();
  const parsed = ReferenceUrlSchema.parse({
    projectId: formData.get("projectId"),
    url: formData.get("url"),
    platform: formData.get("platform") || undefined,
  });
  const supabase = createSupabaseServerClient();
  const canonical = parsed.url.split("?")[0] ?? parsed.url;
  const { error } = await supabase.from("video_evidence").insert({
    project_id: parsed.projectId,
    video_url: parsed.url,
    canonical_url: canonical,
    platform: parsed.platform ?? "tiktok",
    title: "Manual reference",
    fetch_status: "pending",
    source_confidence: 0.5,
    metadata: { source: "manual_reference" },
  } as never);
  if (error) throw new Error(`reference import: ${error.message}`);
  revalidatePath(`/projects/${parsed.projectId}/growth`);
  revalidatePath(`/projects/${parsed.projectId}/video-intelligence`);
}

const PreviewScheduleSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export async function previewScheduleAction(formData: FormData) {
  const user = await requireUser();
  const parsed = PreviewScheduleSchema.parse({
    projectId: formData.get("projectId"),
    growthRunId: formData.get("growthRunId"),
  });
  const supabase = createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", parsed.projectId)
    .single();
  const settings = await loadProjectGrowthSettings(parsed.projectId);
  const cta = resolveProjectCta(settings, project?.product_url ?? null);
  const baseAppUrl =
    process.env.AUTOSCALE_APP_URL ??
    process.env.NEXT_PUBLIC_APP_URL ??
    getManagedProviderConfig().appUrl ??
    "http://localhost:3000";
  return scheduleApprovedVideos({
    growthRunId: parsed.growthRunId,
    projectId: parsed.projectId,
    ownerId: user.id,
    baseAppUrl,
    destinationUrl: cta.url ?? project?.product_url ?? baseAppUrl,
    intentType: cta.intentType,
    previewOnly: true,
  });
}

const SaveGrowthSettingsSchema = z.object({
  projectId: z.string().uuid(),
  operationMode: z.enum(["manual", "assisted", "managed"]),
  primaryCtaType: z.enum([
    "start_free",
    "join_waitlist",
    "book_demo",
    "download_app",
    "buy_now",
    "custom",
  ]),
  bookingUrl: z.string().url().optional().or(z.literal("")),
  bookingProvider: z.enum(["google_calendar", "calendly", "manual", "none"]),
  defaultCtaLabel: z.string().optional(),
  defaultCtaUrl: z.string().url().optional().or(z.literal("")),
  distributionPreference: z.enum(["all_accounts", "selected"]),
  autopilotEnabled: z.coerce.boolean().optional(),
  maxRunsPerDay: z.coerce.number().int().min(0).max(10).optional(),
  onboardingCompleted: z.coerce.boolean().optional(),
});

export async function saveGrowthSettingsAction(formData: FormData) {
  await requireUser();
  const selectedIds = formData.getAll("selectedAccountIds").filter(Boolean) as string[];
  const parsed = SaveGrowthSettingsSchema.parse({
    projectId: formData.get("projectId"),
    operationMode: formData.get("operationMode"),
    primaryCtaType: formData.get("primaryCtaType"),
    bookingUrl: formData.get("bookingUrl") || undefined,
    bookingProvider: formData.get("bookingProvider"),
    defaultCtaLabel: formData.get("defaultCtaLabel") || undefined,
    defaultCtaUrl: formData.get("defaultCtaUrl") || undefined,
    distributionPreference: formData.get("distributionPreference"),
    autopilotEnabled: formData.get("autopilotEnabled") === "on",
    maxRunsPerDay: formData.get("maxRunsPerDay") ?? undefined,
    onboardingCompleted: formData.get("onboardingCompleted") === "on",
  });

  const { upsertProjectGrowthSettings } = await import(
    "@/services/project-growth-settings/persist"
  );
  const { loadProjectGrowthSettings } = await import(
    "@/services/project-growth-settings/load"
  );
  const existingSettings = await loadProjectGrowthSettings(parsed.projectId);
  await upsertProjectGrowthSettings({
    project_id: parsed.projectId,
    operation_mode: parsed.operationMode,
    primary_cta_type: parsed.primaryCtaType,
    booking_url: parsed.bookingUrl || null,
    booking_provider: parsed.bookingProvider,
    default_cta_label: parsed.defaultCtaLabel ?? null,
    default_cta_url: parsed.defaultCtaUrl || null,
    blocked_topics: [],
    blocked_claims: [],
    blocked_competitors: [],
    distribution_preference: parsed.distributionPreference,
    selected_account_ids: selectedIds,
    autopilot_enabled:
      parsed.autopilotEnabled ?? parsed.operationMode === "managed",
    max_runs_per_day: parsed.maxRunsPerDay ?? 1,
    run_cooldown_hours: 24,
    max_active_runs: 1,
    onboarding_completed: parsed.onboardingCompleted ?? true,
    production_format: existingSettings.production_format,
    video_output_mode: existingSettings.video_output_mode,
    quality_tier: existingSettings.quality_tier,
    audio_mode: existingSettings.audio_mode,
  });

  revalidatePath(`/projects/${parsed.projectId}/growth`);
  revalidatePath(`/projects/${parsed.projectId}/growth/settings`);
}

const ContinueStageSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  productionFormat: ProductionFormatSchema.optional(),
  videoOutputMode: VideoOutputModeSchema.optional(),
  qualityTier: QualityTierSchema.optional(),
  audioMode: AudioModeSchema.optional(),
  falRenderMode: FalRenderModeSchema.optional(),
  falModelTier: FalModelTierSchema.optional(),
  visualPipeline: z.union([VisualPipelineSchema, z.literal("auto")]).optional(),
});

export type ContinueGrowthRunStageResult =
  | {
      ok: true;
      growthRunId: string;
      status: string;
      pausedAtPhase?: string;
    }
  | { ok: false; growthRunId?: string; error: string };

/** Continue after a macro-stage boundary pause. Always requires explicit user CTA. */
export async function continueGrowthRunStageAction(
  input: z.infer<typeof ContinueStageSchema>
): Promise<ContinueGrowthRunStageResult> {
  const user = await requireUser();
  const parsed = ContinueStageSchema.parse(input);

  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select("id")
    .eq("id", parsed.growthRunId)
    .eq("project_id", parsed.projectId)
    .maybeSingle();

  if (!run) {
    return { ok: false, error: "Growth run not found." };
  }

  if (
    parsed.productionFormat ||
    parsed.videoOutputMode ||
    parsed.qualityTier ||
    parsed.audioMode ||
    parsed.falRenderMode ||
    parsed.falModelTier ||
    parsed.visualPipeline
  ) {
    const { data: runRow } = await supabase
      .from("growth_runs")
      .select("options")
      .eq("id", parsed.growthRunId)
      .single();
    const existing =
      runRow?.options && typeof runRow.options === "object" && !Array.isArray(runRow.options)
        ? (runRow.options as Record<string, unknown>)
        : {};

    const resolved = resolveProductionOptions({
      productionFormat: parsed.productionFormat ?? null,
      videoOutputMode: parsed.videoOutputMode ?? null,
      qualityTier: parsed.qualityTier ?? null,
      audioMode: parsed.audioMode ?? null,
      falRenderMode: parsed.falRenderMode ?? null,
      falModelTier: parsed.falModelTier ?? null,
      visualPipeline:
        parsed.visualPipeline && parsed.visualPipeline !== "auto"
          ? parsed.visualPipeline
          : null,
      falConfigured: isFalConfigured(),
    });

    await supabase
      .from("growth_runs")
      .update({
        options: {
          ...existing,
          production_format: resolved.productionFormat,
          video_output_mode: resolved.videoOutputMode,
          creative_format: resolved.creativeFormat,
          render_style: resolved.renderStyle,
          quality_tier: resolved.qualityTier,
          max_fal_scenes: resolved.maxFalScenes,
          max_ai_video_scenes: resolved.maxFalScenes,
          require_scene_review:
            typeof existing.require_scene_review === "boolean"
              ? existing.require_scene_review
              : DEFAULT_PRODUCTION_QUALITY_OPTIONS.requireSceneReview,
          fallback_on_bad_ai_scene: coerceFallbackOnBadAiScene(
            typeof existing.fallback_on_bad_ai_scene === "string"
              ? existing.fallback_on_bad_ai_scene
              : DEFAULT_PRODUCTION_QUALITY_OPTIONS.fallbackOnBadAiScene
          ),
          ...(parsed.audioMode ? { audio_mode: resolved.audioMode } : {}),
          ...(parsed.falRenderMode || parsed.qualityTier || parsed.videoOutputMode
            ? { fal_render_mode: resolved.falRenderMode }
            : {}),
          ...(parsed.falModelTier ? { fal_model_tier: resolved.falModelTier } : {}),
          ...(parsed.visualPipeline && parsed.visualPipeline !== "auto"
            ? { visual_pipeline: resolved.visualPipeline }
            : {}),
        },
      })
      .eq("id", parsed.growthRunId);
  }

  try {
    const result = await continueGrowthRunStage({
      growthRunId: parsed.growthRunId,
      ownerId: user.id,
    });

    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${result.growthRunId}`);

    return {
      ok: true,
      growthRunId: result.growthRunId,
      status: result.status,
      pausedAtPhase: result.pausedAtPhase,
    };
  } catch (err) {
    return {
      ok: false,
      growthRunId: parsed.growthRunId,
      error: err instanceof Error ? err.message : "Failed to continue run.",
    };
  }
}

export async function rejectGrowthRunStageAction(
  input: z.infer<typeof ContinueStageSchema>
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const parsed = ContinueStageSchema.parse(input);

  try {
    await rejectGrowthRunPhase({
      growthRunId: parsed.growthRunId,
      projectId: parsed.projectId,
    });
    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel run.",
    };
  }
}

const CancelRunSchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export async function cancelGrowthRunAction(
  input: z.infer<typeof CancelRunSchema>
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const parsed = CancelRunSchema.parse(input);

  try {
    await cancelGrowthRun({
      growthRunId: parsed.growthRunId,
      projectId: parsed.projectId,
    });
    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
    revalidatePath(`/projects/${parsed.projectId}/runs`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to cancel run.",
    };
  }
}

const StageRunSchema = z.object({
  projectId: z.string().uuid(),
  stage: z.coerce.number().int().min(1).max(4),
});

export type StartStageRunResult =
  | { ok: true; growthRunId: string }
  | { ok: false; error: string };

/** Create a stage-only Growth Run (repeat projects) and redirect to execute it. */
export async function startStageRunAction(
  input: z.infer<typeof StageRunSchema>
): Promise<StartStageRunResult> {
  const user = await requireUser();
  const parsed = StageRunSchema.parse(input);
  const stage = parsed.stage as GrowthRunStageId;

  const supabase = createSupabaseServerClient();
  const eligible = await projectHasRepeatRunEligibility(supabase, parsed.projectId);
  if (!eligible) {
    return {
      ok: false,
      error: "Complete your first Growth Run before running individual stages.",
    };
  }

  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", parsed.projectId)
    .single();

  if (stage === 3) {
    const ffmpeg = checkFfmpegHealth();
    if (!ffmpeg.available) {
      return {
        ok: false,
        error: `${ffmpeg.message}${ffmpeg.fixHint ? ` ${ffmpeg.fixHint}` : ""}`,
      };
    }
  }

  const pre = await validateStagePreconditions(supabase, parsed.projectId, stage, {
    productUrl: project?.product_url,
  });
  if (!pre.ok) return { ok: false, error: pre.error };

  if (stage === 4) {
    try {
      const result = await runGrowthRunStageOnly({
        projectId: parsed.projectId,
        ownerId: user.id,
        stage: 4,
        priorRunId: pre.parentRunId ?? undefined,
        productUrl: project?.product_url ?? undefined,
      });
      revalidatePath(`/projects/${parsed.projectId}/growth`);
      revalidatePath(`/projects/${parsed.projectId}/growth/${result.growthRunId}`);
      redirect(`/projects/${parsed.projectId}/growth/${result.growthRunId}`);
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Stage run failed.",
      };
    }
  }

  const ctx = await buildGrowthRunStartContext(parsed.projectId, {
    projectId: parsed.projectId,
    targetPlatforms: ["tiktok"],
    postingAggressiveness: "conservative",
    durationDays: 1,
    formatHypothesisCount: 1,
  });

  const runOptions = {
    ...ctx.growthOptions,
    ...(stage === 1
      ? {
          unified: true,
          product_url: project?.product_url ?? undefined,
          unified_profile: "project" as const,
        }
      : {}),
  };

  const run = await createGrowthRun({
    projectId: parsed.projectId,
    options: runOptions as Record<string, unknown>,
    trigger: "manual",
    approvalMode: ctx.approvalMode,
    postingAggressiveness: ctx.postingAggressiveness,
    targetPlatforms: ctx.targetPlatforms,
    brandConstraints: ctx.brandConstraints as Record<string, unknown>,
    distributionMode: ctx.distributionMode,
    parentRunId: pre.parentRunId ?? null,
    executionMode: "stage_only",
    targetStage: stage,
  });

  revalidatePath(`/projects/${parsed.projectId}/growth`);
  redirect(`/projects/${parsed.projectId}/growth/${run.id}?autoExecute=1`);
}

/** Alias for repeat-project stage-only runs. */
export const startStageOnlyRunAction = startStageRunAction;

const RunStageOnlySchema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
  stage: z.coerce.number().int().min(1).max(4),
});

export type RunStageOnlyResult = ExecuteGrowthRunResult;

export async function runStageOnlyAction(
  input: z.infer<typeof RunStageOnlySchema>
): Promise<RunStageOnlyResult> {
  const user = await requireUser();
  const parsed = RunStageOnlySchema.parse(input);
  const stage = parsed.stage as GrowthRunStageId;

  if (stage === 3) {
    const ffmpeg = checkFfmpegHealth();
    if (!ffmpeg.available) {
      return {
        ok: false,
        error: `${ffmpeg.message}${ffmpeg.fixHint ? ` ${ffmpeg.fixHint}` : ""}`,
      };
    }
  }

  try {
    const result = await runGrowthRunStage({
      growthRunId: parsed.growthRunId,
      ownerId: user.id,
      stage,
    });

    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${result.growthRunId}`);

    return {
      ok: true,
      growthRunId: result.growthRunId,
      status: result.status,
      pausedAtPhase: result.pausedAtPhase,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as { name?: unknown }).name === "GrowthRunExecutionError" &&
      typeof (error as { growthRunId?: unknown }).growthRunId === "string"
    ) {
      const growthRunId = (error as { growthRunId: string }).growthRunId;
      revalidatePath(`/projects/${parsed.projectId}/growth/${growthRunId}`);
      return { ok: true, growthRunId, status: "failed" };
    }
    return {
      ok: false,
      growthRunId: parsed.growthRunId,
      error: error instanceof Error ? error.message : "Stage run failed.",
    };
  }
}

const RerunStage3Schema = z.object({
  projectId: z.string().uuid(),
  growthRunId: z.string().uuid(),
});

export type RerunStage3Result = ExecuteGrowthRunResult;

/** Reset Stage 3 artifacts on this run and re-render from assets. */
export async function rerunStage3Action(
  input: z.infer<typeof RerunStage3Schema>
): Promise<RerunStage3Result> {
  const user = await requireUser();
  const parsed = RerunStage3Schema.parse(input);

  const ffmpeg = checkFfmpegHealth();
  if (!ffmpeg.available) {
    return {
      ok: false,
      error: `${ffmpeg.message}${ffmpeg.fixHint ? ` ${ffmpeg.fixHint}` : ""}`,
    };
  }

  try {
    const result = await rerunGrowthRunStage3({
      growthRunId: parsed.growthRunId,
      ownerId: user.id,
    });

    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${result.growthRunId}`);

    return {
      ok: true,
      growthRunId: result.growthRunId,
      status: result.status,
      pausedAtPhase: result.pausedAtPhase,
    };
  } catch (error) {
    if (
      error &&
      typeof error === "object" &&
      (error as { name?: unknown }).name === "GrowthRunExecutionError" &&
      typeof (error as { growthRunId?: unknown }).growthRunId === "string"
    ) {
      const growthRunId = (error as { growthRunId: string }).growthRunId;
      revalidatePath(`/projects/${parsed.projectId}/growth/${growthRunId}`);
      return { ok: true, growthRunId, status: "failed" };
    }
    return {
      ok: false,
      growthRunId: parsed.growthRunId,
      error: error instanceof Error ? error.message : "Stage 3 rerun failed.",
    };
  }
}

export async function finalizeStageOnlyRunAction(
  input: z.infer<typeof ContinueStageSchema>
): Promise<{ ok: boolean; error?: string }> {
  await requireUser();
  const parsed = ContinueStageSchema.parse(input);

  try {
    await finalizeStageOnlyRun({ growthRunId: parsed.growthRunId });
    revalidatePath(`/projects/${parsed.projectId}/growth`);
    revalidatePath(`/projects/${parsed.projectId}/growth/${parsed.growthRunId}`);
    return { ok: true };
  } catch (err) {
    return {
      ok: false,
      error: err instanceof Error ? err.message : "Failed to finalize run.",
    };
  }
}
