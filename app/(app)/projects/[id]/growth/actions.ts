"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/server";
import { startGrowthRun } from "@/services/growth-run/orchestrator";
import { scheduleApprovedVideos } from "@/services/postiz/multi-account";
import { runCompound } from "@/services/compound/classify";
import {
  reviseHook,
  reviseSceneText,
  regenerateSceneVisual,
  regenerateVoiceover,
  regenerateCaptions,
  rerenderVideo,
} from "@/services/video-revision";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { fetchPostizIntegrations } from "@/services/postiz/client";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { getManagedProviderConfig } from "@/services/providers/config";
import {
  loadProjectGrowthSettings,
  resolveConnectedAccountIds,
} from "@/services/project-growth-settings/load";
import { resolveProjectCta } from "@/services/project-growth-settings/schema";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";

const StartRunSchema = z.object({
  projectId: z.string().uuid(),
  targetPlatforms: z
    .array(z.enum(["tiktok", "instagram", "youtube"]))
    .min(1)
    .default(["tiktok", "instagram", "youtube"]),
  approvalMode: z.enum(["manual", "per_format", "autopilot"]).optional(),
  postingAggressiveness: z
    .enum(["conservative", "balanced", "aggressive"])
    .default("balanced"),
  durationDays: z.coerce.number().int().min(1).max(60).default(7),
  formatHypothesisCount: z.coerce.number().int().min(1).max(2).default(2),
  distributionPreference: z
    .enum(["all_accounts", "selected", "export_only"])
    .optional(),
  selectedAccountIds: z.array(z.string().uuid()).optional(),
});

export async function startGrowthRunAction(formData: FormData) {
  const user = await requireUser();
  const parsed = StartRunSchema.safeParse({
    projectId: formData.get("projectId"),
    targetPlatforms: formData.getAll("targetPlatforms").filter(Boolean),
    approvalMode: formData.get("approvalMode") ?? undefined,
    postingAggressiveness: formData.get("postingAggressiveness") ?? undefined,
    durationDays: formData.get("durationDays") ?? undefined,
    formatHypothesisCount: formData.get("formatHypothesisCount") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const ffmpeg = checkFfmpegHealth();
  if (!ffmpeg.available) {
    throw new Error(`${ffmpeg.message}${ffmpeg.fixHint ? ` ${ffmpeg.fixHint}` : ""}`);
  }

  const supabase = createSupabaseServerClient();
  const settings = await loadProjectGrowthSettings(parsed.data.projectId);
  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", parsed.data.projectId)
    .single();
  const cta = resolveProjectCta(settings, project?.product_url ?? null);

  const distPref =
    parsed.data.distributionPreference ?? settings.distribution_preference;
  const accountSettings = {
    ...settings,
    distribution_preference: distPref,
    selected_account_ids:
      parsed.data.selectedAccountIds ?? settings.selected_account_ids,
  };
  const { accountIds, distributionMode } = await resolveConnectedAccountIds(
    parsed.data.projectId,
    accountSettings
  );

  const approvalMode =
    parsed.data.approvalMode ??
    (settings.operation_mode === "managed"
      ? "autopilot"
      : settings.operation_mode === "assisted"
        ? "per_format"
        : "manual");

  let growthRunId: string;
  try {
    const result = await startGrowthRun({
      projectId: parsed.data.projectId,
      ownerId: user.id,
      options: {
        target_platforms: parsed.data.targetPlatforms,
        approval_mode: approvalMode,
        posting_aggressiveness: parsed.data.postingAggressiveness,
        duration_days: parsed.data.durationDays,
        concept_target_count: parsed.data.formatHypothesisCount * 3,
        connected_account_ids: accountIds,
        distribution_mode: distributionMode,
        brand_constraints: {
          primary_cta_label: cta.label,
          primary_cta_url: cta.url,
          cta_intent: cta.intentType,
          booking_warning: cta.setupWarning,
        },
      },
    });
    growthRunId = result.growthRunId;
  } catch (error) {
    if (
      !error ||
      typeof error !== "object" ||
      (error as { name?: unknown }).name !== "GrowthRunExecutionError" ||
      typeof (error as { growthRunId?: unknown }).growthRunId !== "string"
    ) {
      throw error;
    }
    // The run is persisted with its failed phase and error. Send the founder
    // there instead of leaking a framework overlay and losing the evidence.
    growthRunId = (error as { growthRunId: string }).growthRunId;
  }

  revalidatePath(`/projects/${parsed.data.projectId}/growth`);
  redirect(`/projects/${parsed.data.projectId}/growth/${growthRunId}`);
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

  const supabase = createSupabaseServerClient();
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
  const supabase = createSupabaseServerClient();
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
  const { error } = await supabase.from("video_run_metrics").insert({
    project_id: parsed.projectId,
    growth_run_id: parsed.growthRunId,
    schedule_item_id: parsed.scheduleItemId,
    video_id: parsed.videoId,
    source: "manual",
    views: parsed.views ?? null,
    likes: parsed.likes ?? null,
    comments: parsed.comments ?? null,
    shares: parsed.shares ?? null,
    saves: parsed.saves ?? null,
    completion_rate: parsed.completionRate ?? null,
    link_clicks: parsed.linkClicks ?? null,
    signups: parsed.signups ?? null,
  });
  if (error) throw new Error(`metrics insert: ${error.message}`);
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

export async function syncPostizAccountsAction(formData: FormData): Promise<void> {
  const user = await requireUser();
  const parsed = SyncAccountsSchema.parse({ projectId: formData.get("projectId") });
  const mode = await getProviderModeForUser(user.id);
  const credentials = await resolvePostizCredentials(user.id, mode);
  if (!credentials) {
    throw new Error(
      "Postiz is not connected. Add POSTIZ_API_URL + POSTIZ_API_KEY (managed) or connect Postiz in Settings (BYOK)."
    );
  }
  const integrations = await fetchPostizIntegrations(credentials);
  const supabase = createSupabaseServerClient();
  const wanted = ["tiktok", "instagram", "youtube"];
  const rows = integrations
    .filter((i) => wanted.includes(i.identifier))
    .map((i) => ({
      project_id: parsed.projectId,
      platform: i.identifier as "tiktok" | "instagram" | "youtube",
      handle: i.profile ?? i.name,
      display_name: i.name,
      postiz_account_id: i.id,
      postiz_provider_id: i.identifier,
      status: i.disabled ? ("paused" as const) : ("active" as const),
    }));
  if (rows.length) {
    await supabase
      .from("connected_accounts")
      .upsert(rows, { onConflict: "project_id,platform,handle", ignoreDuplicates: false });
  }
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
  distributionPreference: z.enum(["all_accounts", "selected", "export_only"]),
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
  });

  revalidatePath(`/projects/${parsed.projectId}/growth`);
  revalidatePath(`/projects/${parsed.projectId}/growth/settings`);
}
