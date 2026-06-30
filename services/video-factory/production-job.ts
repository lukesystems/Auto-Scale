import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
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
export type RenderPhase = (typeof RENDER_PHASES)[number];

export async function saveRenderCheckpoint(
  jobId: string,
  phase: RenderPhase,
  metadata: Record<string, unknown>
): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("video_production_jobs")
    .select("metadata")
    .eq("id", jobId)
    .maybeSingle();
  const existing =
    data?.metadata && typeof data.metadata === "object" && !Array.isArray(data.metadata)
      ? (data.metadata as Record<string, unknown>)
      : {};
  await supabase
    .from("video_production_jobs")
    .update({
      metadata: {
        ...existing,
        render_checkpoint: phase,
        render_artifact: metadata,
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
}): Promise<{ jobId: string }> {
  const supabase = createSupabaseServerClient();
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
  error?: string | null
): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase
    .from("video_production_jobs")
    .update({
      status,
      current_stage: currentStage,
      error: error ?? null,
    } as never)
    .eq("id", jobId);
}

export async function linkStoryboardToJob(storyboardId: string, jobId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase.from("storyboards").update({ production_job_id: jobId } as never).eq("id", storyboardId);
  await supabase
    .from("storyboard_scenes")
    .update({ production_job_id: jobId } as never)
    .eq("storyboard_id", storyboardId);
}

export async function tagAssetsWithJob(conceptId: string, jobId: string): Promise<void> {
  const supabase = createSupabaseServerClient();
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
