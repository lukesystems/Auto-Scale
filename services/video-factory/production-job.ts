import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;
import { resolvePlatformProfile, type PlatformProfile } from "./render-profiles";
import type { ProductionMode } from "./production-modes";

export type ProductionJobStatus =
  | "queued"
  | "planning"
  | "generating_assets"
  | "generating_audio"
  | "generating_subs"
  | "assembling"
  | "uploading"
  | "quality_check"
  | "ready"
  | "failed"
  | "partial";

export const RENDER_PHASES = [
  "queued",
  "assets",
  "audio",
  "subs",
  "assemble",
  "upload",
  "done",
] as const;
export type RenderPhase = (typeof RENDER_PHASES)[number] | `scene:${string}:visual`;

export function sceneVisualCheckpoint(sceneId: string): `scene:${string}:visual` {
  return `scene:${sceneId}:visual`;
}

export async function saveRenderCheckpoint(
  jobId: string,
  phase: RenderPhase,
  metadata: Record<string, unknown>,
  client?: Client
): Promise<void> {
  const supabase = client ?? createSupabaseServerClient();
  const { data } = await supabase
    .from("video_production_jobs")
    .select("metadata")
    .eq("id", jobId)
    .maybeSingle();
  const existing =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  const renderTiming =
    existing.render_timing && typeof existing.render_timing === "object" && !Array.isArray(existing.render_timing)
      ? (existing.render_timing as Record<string, unknown>)
      : {};
  await supabase
    .from("video_production_jobs")
    .update({
      metadata: {
        ...existing,
        render_checkpoint: phase,
        render_artifact: metadata,
        render_timing: {
          ...renderTiming,
          [phase]: new Date().toISOString(),
        },
      } as never,
    } as never)
    .eq("id", jobId);
}

export async function ensureProductionJob(opts: {
  projectId: string;
  growthRunId: string;
  videoId: string;
  conceptId: string;
  productionMode: ProductionMode | string | null;
  platform: string;
  client?: Client;
}): Promise<{ jobId: string }> {
  const supabase = opts.client ?? createSupabaseServerClient();
  const platformProfile = resolvePlatformProfile(opts.platform);

  const { data: existing } = await supabase
    .from("video_production_jobs")
    .select("id")
    .eq("video_id", opts.videoId)
    .maybeSingle();
  if (existing?.id) return { jobId: existing.id };

  const { data: job, error } = await supabase
    .from("video_production_jobs")
    .insert({
      project_id: opts.projectId,
      growth_run_id: opts.growthRunId,
      video_id: opts.videoId,
      concept_id: opts.conceptId,
      production_mode: opts.productionMode,
      platform_profile: platformProfile,
      status: "queued",
      current_stage: "queued",
      queued_at: new Date().toISOString(),
      stage_started_at: new Date().toISOString(),
    } as never)
    .select("id")
    .single();
  if (error) throw new Error(`video_production_jobs insert: ${error.message}`);
  return { jobId: job!.id };
}

export async function setProductionJobStage(
  jobId: string,
  status: ProductionJobStatus,
  currentStage: string,
  error?: string | null,
  client?: Client
): Promise<void> {
  const supabase = client ?? createSupabaseServerClient();
  const now = new Date().toISOString();
  const terminal = status === "ready" || status === "failed" || status === "partial";
  let renderDurationMs: number | null = null;
  if (terminal) {
    const { data } = await supabase
      .from("video_production_jobs")
      .select("render_started_at")
      .eq("id", jobId)
      .maybeSingle();
    const startedAt = data?.render_started_at ? new Date(data.render_started_at).getTime() : NaN;
    if (Number.isFinite(startedAt)) {
      renderDurationMs = Math.max(0, Date.now() - startedAt);
    }
  }
  await supabase
    .from("video_production_jobs")
    .update({
      status,
      current_stage: currentStage,
      error: error ?? null,
      stage_started_at: now,
      ...(status === "queued" ? { queued_at: now } : {}),
      ...(currentStage === "claimed" || currentStage === "render" ? { render_started_at: now } : {}),
      ...(terminal ? { render_completed_at: now, render_duration_ms: renderDurationMs } : {}),
    } as never)
    .eq("id", jobId);
}

export async function linkStoryboardToJob(
  storyboardId: string,
  jobId: string,
  client?: Client
): Promise<void> {
  const supabase = client ?? createSupabaseServerClient();
  await supabase.from("storyboards").update({ production_job_id: jobId } as never).eq("id", storyboardId);
  await supabase
    .from("storyboard_scenes")
    .update({ production_job_id: jobId } as never)
    .eq("storyboard_id", storyboardId);
}

export async function tagAssetsWithJob(
  conceptId: string,
  jobId: string,
  client?: Client
): Promise<void> {
  const supabase = client ?? createSupabaseServerClient();
  await supabase
    .from("generated_assets")
    .update({ production_job_id: jobId } as never)
    .eq("concept_id", conceptId);
}

export function mapVideoStatusToJobStatus(videoStatus: string): ProductionJobStatus {
  switch (videoStatus) {
    case "ready":
    case "approved":
    case "posted":
      return "ready";
    case "failed":
      return "failed";
    case "rendering":
      return "assembling";
    default:
      return "queued";
  }
}
