import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createSupabaseAdminClient } from "@/lib/supabase/server";

type Client = SupabaseClient<Database>;

export const AWAITING_WORKER_STAGE = "awaiting_worker";

export interface ClaimedRenderJob {
  id: string;
  project_id: string;
  growth_run_id: string;
  video_id: string;
  concept_id: string;
}

/**
 * Atomically claim queued render jobs (idempotent — only `queued` rows transition).
 */
export async function claimRenderJobs(opts?: {
  limit?: number;
  growthRunId?: string;
  client?: Client;
}): Promise<ClaimedRenderJob[]> {
  const admin = opts?.client ?? createSupabaseAdminClient();
  const limit = opts?.limit ?? 8;

  let query = admin
    .from("video_production_jobs")
    .select("id, project_id, growth_run_id, video_id, concept_id, status, current_stage")
    .eq("status", "queued")
    .eq("current_stage", AWAITING_WORKER_STAGE)
    .order("created_at", { ascending: true })
    .limit(limit);

  if (opts?.growthRunId) {
    query = query.eq("growth_run_id", opts.growthRunId);
  }

  const { data: candidates, error } = await query;
  if (error) throw new Error(`claim query: ${error.message}`);
  if (!candidates?.length) return [];

  const claimed: ClaimedRenderJob[] = [];
  for (const job of candidates) {
    const { data: locked, error: lockErr } = await admin
      .from("video_production_jobs")
      .update({
        status: "assembling",
        current_stage: "claimed",
        stage_started_at: new Date().toISOString(),
        render_started_at: new Date().toISOString(),
        error: null,
      } as never)
      .eq("id", job.id)
      .eq("status", "queued")
      .eq("current_stage", AWAITING_WORKER_STAGE)
      .select("id, project_id, growth_run_id, video_id, concept_id")
      .maybeSingle();

    if (lockErr) throw new Error(`claim lock: ${lockErr.message}`);
    if (locked) claimed.push(locked);
  }

  return claimed;
}

export async function findExistingQueuedRenderJob(
  client: Client,
  growthRunId: string,
  conceptId: string
): Promise<{ jobId: string; videoId: string } | null> {
  const { data: job } = await client
    .from("video_production_jobs")
    .select("id, video_id, status, current_stage")
    .eq("growth_run_id", growthRunId)
    .eq("concept_id", conceptId)
    .maybeSingle();

  if (!job?.id || !job.video_id) return null;

  const rerenderable = new Set(["queued", "failed", "partial"]);
  if (!rerenderable.has(job.status)) return null;
  if (job.status === "queued" && job.current_stage !== AWAITING_WORKER_STAGE) return null;

  return { jobId: job.id, videoId: job.video_id };
}
