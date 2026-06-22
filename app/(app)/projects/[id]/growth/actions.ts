"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/server";
import { startGrowthRun } from "@/services/growth-run/orchestrator";
import { scheduleApprovedVideos } from "@/services/postiz/multi-account";
import { runCompound } from "@/services/compound/classify";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { fetchPostizIntegrations } from "@/services/postiz/client";
import { getProviderModeForUser } from "@/lib/provider-mode";
import { getManagedProviderConfig } from "@/services/providers/config";

const StartRunSchema = z.object({
  projectId: z.string().uuid(),
  targetPlatforms: z
    .array(z.enum(["tiktok", "instagram", "youtube"]))
    .min(1)
    .default(["tiktok", "instagram", "youtube"]),
  approvalMode: z.enum(["manual", "per_format", "autopilot"]).default("manual"),
  postingAggressiveness: z
    .enum(["conservative", "balanced", "aggressive"])
    .default("balanced"),
  durationDays: z.coerce.number().int().min(1).max(60).default(7),
  conceptTargetCount: z.coerce.number().int().min(3).max(30).default(12),
});

export async function startGrowthRunAction(formData: FormData) {
  const user = await requireUser();
  const parsed = StartRunSchema.safeParse({
    projectId: formData.get("projectId"),
    targetPlatforms: formData.getAll("targetPlatforms").filter(Boolean),
    approvalMode: formData.get("approvalMode") ?? undefined,
    postingAggressiveness: formData.get("postingAggressiveness") ?? undefined,
    durationDays: formData.get("durationDays") ?? undefined,
    conceptTargetCount: formData.get("conceptTargetCount") ?? undefined,
  });
  if (!parsed.success) {
    throw new Error(parsed.error.issues.map((i) => i.message).join("; "));
  }

  const { growthRunId } = await startGrowthRun({
    projectId: parsed.data.projectId,
    ownerId: user.id,
    options: {
      target_platforms: parsed.data.targetPlatforms,
      approval_mode: parsed.data.approvalMode,
      posting_aggressiveness: parsed.data.postingAggressiveness,
      duration_days: parsed.data.durationDays,
      concept_target_count: parsed.data.conceptTargetCount,
      connected_account_ids: [],
      brand_constraints: {},
    },
  });

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
  const destinationUrl = project?.product_url ?? getManagedProviderConfig().appUrl ?? "https://example.com";

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
