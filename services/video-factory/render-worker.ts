import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { mapWithConcurrency } from "@/lib/async-pool";
import { loadConnectedAccounts } from "@/services/growth-run/repository";
import { withProjectAIContext } from "@/services/ai/runtime";
import { resolveOpenRouterModelSlug } from "@/services/ai/model-aliases";
import { isFfmpegAvailable } from "./ffmpeg";
import { generateCaptionsForVideo } from "./captions";
import { generateSceneAsset, queueFinalAssembly, queueVoiceover } from "./assets";
import { loadRunProductionContext } from "./load-run-production-context";
import { runPreRenderGate } from "./pre-render-gate";
import { renderConceptVideo } from "./render-concept";
import {
  ensureProductionJob,
  linkStoryboardToJob,
  setProductionJobStage,
  tagAssetsWithJob,
} from "./production-job";
import { normalizeProductionMode, resolveProductionMode } from "./production-modes";
import { syncStage3RunPhase } from "@/services/growth-run/sync-stage3";

import {
  AWAITING_WORKER_STAGE,
  claimRenderJobs,
  findExistingQueuedRenderJob,
  type ClaimedRenderJob,
} from "./render-job-queue";

type Client = SupabaseClient<Database>;

function envPositiveInt(name: string, fallback: number, max: number): number {
  const raw = process.env[name]?.trim();
  const parsed = raw ? Number.parseInt(raw, 10) : NaN;
  if (!Number.isFinite(parsed) || parsed < 1) return fallback;
  return Math.min(parsed, max);
}

/** Max concepts rendered in parallel per worker batch. */
export const RENDER_CONCEPT_CONCURRENCY = envPositiveInt(
  "AUTOSCALE_RENDER_CONCEPT_CONCURRENCY",
  4,
  12
);

/** Max jobs claimed per worker invocation. */
export const RENDER_WORKER_CLAIM_BATCH = envPositiveInt(
  "AUTOSCALE_RENDER_WORKER_CLAIM_BATCH",
  16,
  40
);

const LOCAL_WORKER_DRAIN_BATCHES = envPositiveInt(
  "AUTOSCALE_RENDER_LOCAL_DRAIN_BATCHES",
  4,
  20
);

export interface EnqueueRenderResult {
  videoIds: string[];
  jobIds: string[];
  failures: Array<{ conceptId: string; error: string }>;
}

export type { ClaimedRenderJob } from "./render-job-queue";
export { claimRenderJobs } from "./render-job-queue";

export interface RenderWorkerBatchResult {
  claimed: number;
  processed: number;
  succeeded: number;
  failed: number;
  errors: string[];
}

async function loadConcept(client: Client, conceptId: string) {
  const { data: concept, error } = await client
    .from("video_concepts")
    .select("id, video_type, platform, target_length_seconds, hook, cta, production_mode")
    .eq("id", conceptId)
    .single();
  if (error || !concept) throw new Error(`concept missing: ${error?.message}`);

  const productionMode = normalizeProductionMode(
    (concept.production_mode as ReturnType<typeof resolveProductionMode> | null) ??
      resolveProductionMode(concept.video_type as never)
  );
  if (concept.production_mode !== productionMode) {
    await client
      .from("video_concepts")
      .update({ production_mode: productionMode })
      .eq("id", conceptId);
  }

  return { concept, productionMode };
}

/**
 * Prepare production jobs and video rows for async Stage 3 rendering.
 * Does not block on FFmpeg / Fal — worker picks up queued jobs.
 */
export async function enqueueRenderJobsForRun(opts: {
  growthRunId: string;
  projectId: string;
  conceptIds: string[];
  connectedAccountIds?: string[];
  client?: Client;
}): Promise<EnqueueRenderResult> {
  const supabase = opts.client ?? createSupabaseServerClient();
  const runProduction = await loadRunProductionContext(opts.growthRunId, opts.projectId, supabase);
  const { resolved: productionOptions, storedRunOptions: runOpts } = runProduction;

  const videoIds: string[] = [];
  const jobIds: string[] = [];
  const failures: Array<{ conceptId: string; error: string }> = [];

  for (const conceptId of opts.conceptIds) {
    try {
      const { data: reusableVideo } = await supabase
        .from("videos")
        .select("id, final_asset_id")
        .eq("growth_run_id", opts.growthRunId)
        .eq("concept_id", conceptId)
        .eq("status", "ready")
        .maybeSingle();
      if (reusableVideo?.id && reusableVideo.final_asset_id) {
        videoIds.push(reusableVideo.id);
        continue;
      }

      const existingJob = await findExistingQueuedRenderJob(supabase, opts.growthRunId, conceptId);
      if (existingJob) {
        jobIds.push(existingJob.jobId);
        videoIds.push(existingJob.videoId);
        continue;
      }

      const { concept, productionMode } = await loadConcept(supabase, conceptId);

      const { data: conceptRow } = await supabase
        .from("video_concepts")
        .select("render_approved, hook, production_mode")
        .eq("id", conceptId)
        .maybeSingle();
      if (conceptRow?.render_approved === false) {
        failures.push({ conceptId, error: "Concept not approved for render" });
        continue;
      }

      const { data: storyboard } = await supabase
        .from("storyboards")
        .select("id, aspect_ratio, total_duration_seconds")
        .eq("concept_id", conceptId)
        .maybeSingle();
      if (!storyboard) throw new Error("storyboard not found — run scripts/storyboards first");

      const { data: scenes, error: scErr } = await supabase
        .from("storyboard_scenes")
        .select("*")
        .eq("storyboard_id", storyboard.id)
        .order("scene_index");
      if (scErr) throw new Error(`scenes load: ${scErr.message}`);

      const { data: scriptRow } = await supabase
        .from("video_scripts")
        .select("voiceover_full, hook_line, body_lines, cta_line, estimated_duration_seconds")
        .eq("concept_id", conceptId)
        .maybeSingle();

      const { audioMode, productionFormat, visualPipeline } = productionOptions;

      const { data: receipt } = await supabase
        .from("trend_receipts")
        .select("confidence")
        .eq("concept_id", conceptId)
        .maybeSingle();

      if (scriptRow) {
        const gate = runPreRenderGate({
          hook: conceptRow?.hook ?? concept.hook,
          cta: concept.cta ?? "",
          script: {
            hook_line: scriptRow.hook_line ?? concept.hook,
            body_lines: Array.isArray(scriptRow.body_lines) ? (scriptRow.body_lines as string[]) : [],
            cta_line: scriptRow.cta_line ?? concept.cta ?? "",
            voiceover_full: scriptRow.voiceover_full ?? "",
            on_screen_text: [],
            estimated_duration_seconds:
              scriptRow.estimated_duration_seconds ?? concept.target_length_seconds,
          },
          targetLengthSeconds: concept.target_length_seconds,
          sceneDurationsSeconds: (scenes ?? []).map((s) => Number(s.duration_seconds)),
          audioMode,
          productionFormat,
          trendConfidence: receipt?.confidence != null ? Number(receipt.confidence) : null,
          lowEvidenceAcknowledged: runOpts.low_evidence_acknowledged ?? false,
        });
        if (!gate.passed) {
          failures.push({
            conceptId,
            error: `Pre-render gate blocked: ${gate.blockReasons.join("; ")}`,
          });
          continue;
        }
      }

      const voiceoverText =
        (scriptRow?.voiceover_full as string | null) ??
        (scenes ?? [])
          .map((s) => (s.voiceover_line as string | null) ?? "")
          .filter(Boolean)
          .join(" ");

      await queueVoiceover({
        projectId: opts.projectId,
        growthRunId: opts.growthRunId,
        conceptId,
        scriptText: voiceoverText,
      });

      for (const scene of scenes ?? []) {
        await generateSceneAsset({
          projectId: opts.projectId,
          growthRunId: opts.growthRunId,
          conceptId,
          sceneId: scene.id,
          role: scene.role,
          assetMethod: scene.asset_method,
          assetPrompt: scene.asset_prompt,
          onScreenText: scene.on_screen_text,
          voiceoverLine: scene.voiceover_line,
          durationSeconds: Number(scene.duration_seconds),
          aspectRatio: storyboard.aspect_ratio as string,
          visualPipeline,
        });
      }

      const { videoId, assetId: finalAssetId } = await queueFinalAssembly({
        projectId: opts.projectId,
        growthRunId: opts.growthRunId,
        conceptId,
        aspectRatio: storyboard.aspect_ratio as string,
        durationSeconds: Math.round(Number(storyboard.total_duration_seconds)),
      });

      const { jobId } = await ensureProductionJob({
        projectId: opts.projectId,
        growthRunId: opts.growthRunId,
        videoId,
        conceptId,
        productionMode,
        platform: concept.platform,
        client: supabase,
      });
      await linkStoryboardToJob(storyboard.id, jobId, supabase);
      await setProductionJobStage(jobId, "planning", "storyboard", null, supabase);
      await setProductionJobStage(jobId, "generating_audio", "voiceover_queue", null, supabase);
      await setProductionJobStage(jobId, "generating_assets", "scene_asset_stubs", null, supabase);

      if (!isFfmpegAvailable()) {
        const error =
          "FFmpeg is unavailable. Stage 3 rendering cannot produce a ready MP4 in this environment.";
        await setProductionJobStage(jobId, "failed", "awaiting_ffmpeg", error, supabase);
        await supabase.from("videos").update({ status: "failed" }).eq("id", videoId);
        await supabase
          .from("generated_assets")
          .update({
            status: "failed",
            metadata: {
              aspect_ratio: storyboard.aspect_ratio,
              error,
            } as never,
          } as never)
          .eq("id", finalAssetId);
        failures.push({ conceptId, error });
        continue;
      }

      await setProductionJobStage(jobId, "queued", AWAITING_WORKER_STAGE, null, supabase);
      await supabase
        .from("video_production_jobs")
        .update({
          metadata: {
            final_asset_id: finalAssetId,
            enqueued_at: new Date().toISOString(),
          } as never,
        } as never)
        .eq("id", jobId);

      videoIds.push(videoId);
      jobIds.push(jobId);
    } catch (err) {
      failures.push({
        conceptId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { videoIds, jobIds, failures };
}

async function loadFinalAssetId(client: Client, jobId: string): Promise<string> {
  const { data: job } = await client
    .from("video_production_jobs")
    .select("metadata, video_id")
    .eq("id", jobId)
    .maybeSingle();

  const meta =
    job?.metadata && typeof job.metadata === "object" && !Array.isArray(job.metadata)
      ? (job.metadata as Record<string, unknown>)
      : {};
  if (typeof meta.final_asset_id === "string") return meta.final_asset_id;

  const { data: video } = await client
    .from("videos")
    .select("final_asset_id")
    .eq("id", job?.video_id ?? "")
    .maybeSingle();
  if (!video?.final_asset_id) throw new Error("final asset missing for render job");
  return video.final_asset_id;
}

async function processClaimedRenderJob(
  job: ClaimedRenderJob,
  client: Client
): Promise<{ ok: boolean; error?: string }> {
  try {
    const finalAssetId = await loadFinalAssetId(client, job.id);
    const runProduction = await loadRunProductionContext(job.growth_run_id, job.project_id, client);

    await setProductionJobStage(job.id, "generating_audio", "render_audio", null, client);
    await setProductionJobStage(job.id, "generating_assets", "render_scenes", null, client);
    await setProductionJobStage(job.id, "assembling", "render", null, client);

    const renderResult = await renderConceptVideo({
      projectId: job.project_id,
      growthRunId: job.growth_run_id,
      conceptId: job.concept_id,
      videoId: job.video_id,
      finalAssetId,
      jobId: job.id,
      productionContext: runProduction,
      client,
    });

    await tagAssetsWithJob(job.concept_id, job.id, client);

    if (!renderResult.qualityPassed) {
      await setProductionJobStage(
        job.id,
        "failed",
        "quality_gate_failed",
        renderResult.qualityBlockReason ?? "Quality gate failed",
        client
      );
      return {
        ok: false,
        error: renderResult.qualityBlockReason ?? "Video failed quality gate",
      };
    }

    await setProductionJobStage(job.id, "quality_check", "quality_gate", null, client);
    await setProductionJobStage(job.id, "ready", "ready", null, client);

    const accounts = await loadConnectedAccounts(job.project_id);
    const { data: concept } = await client
      .from("video_concepts")
      .select("platform")
      .eq("id", job.concept_id)
      .maybeSingle();
    const platformAccounts = accounts
      .filter((a) => a.platform === concept?.platform)
      .map((a) => ({
        id: a.id,
        platform: a.platform,
        handle: a.handle,
        persona: a.persona,
      }));

    if (platformAccounts.length) {
      const { data: project } = await client
        .from("projects")
        .select("ai_model_slug")
        .eq("id", job.project_id)
        .maybeSingle();
      const modelSlug = resolveOpenRouterModelSlug(project?.ai_model_slug ?? null);
      await withProjectAIContext(modelSlug, async () => {
        await generateCaptionsForVideo({
          videoId: job.video_id,
          conceptId: job.concept_id,
          projectId: job.project_id,
          accounts: platformAccounts,
          client,
        });
      });
    }

    return { ok: true };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await setProductionJobStage(job.id, "failed", "render", message, client);
    await client.from("videos").update({ status: "failed" }).eq("id", job.video_id);
    return { ok: false, error: message };
  }
}

/**
 * Claim and process pending render jobs with bounded concept parallelism.
 */
export async function runRenderWorkerBatch(opts?: {
  growthRunId?: string;
  claimLimit?: number;
  client?: Client;
}): Promise<RenderWorkerBatchResult> {
  const client = opts?.client ?? createSupabaseAdminClient();
  const claimed = await claimRenderJobs({
    limit: opts?.claimLimit,
    growthRunId: opts?.growthRunId,
    client,
  });

  if (!claimed.length) {
    return { claimed: 0, processed: 0, succeeded: 0, failed: 0, errors: [] };
  }

  const results = await mapWithConcurrency(
    claimed,
    RENDER_CONCEPT_CONCURRENCY,
    (job) => processClaimedRenderJob(job, client)
  );

  const succeeded = results.filter((r) => r.ok).length;
  const failed = results.length - succeeded;
  const errors = results.flatMap((r) => (r.error ? [r.error] : []));

  const runIds = [...new Set(claimed.map((j) => j.growth_run_id))];
  for (const growthRunId of runIds) {
    const { data: run } = await client
      .from("growth_runs")
      .select("project_id")
      .eq("id", growthRunId)
      .maybeSingle();
    const { data: project } = run?.project_id
      ? await client.from("projects").select("owner_id").eq("id", run.project_id).maybeSingle()
      : { data: null };
    await syncStage3RunPhase(client, growthRunId, project?.owner_id);
  }

  return {
    claimed: claimed.length,
    processed: results.length,
    succeeded,
    failed,
    errors,
  };
}

export async function runRenderWorkerUntilIdle(opts?: {
  growthRunId?: string;
  claimLimit?: number;
  maxBatches?: number;
  client?: Client;
}): Promise<RenderWorkerBatchResult> {
  const client = opts?.client ?? createSupabaseAdminClient();
  const maxBatches = opts?.maxBatches ?? LOCAL_WORKER_DRAIN_BATCHES;
  const total: RenderWorkerBatchResult = {
    claimed: 0,
    processed: 0,
    succeeded: 0,
    failed: 0,
    errors: [],
  };

  for (let batchIndex = 0; batchIndex < maxBatches; batchIndex++) {
    const batch = await runRenderWorkerBatch({
      growthRunId: opts?.growthRunId,
      claimLimit: opts?.claimLimit,
      client,
    });
    total.claimed += batch.claimed;
    total.processed += batch.processed;
    total.succeeded += batch.succeeded;
    total.failed += batch.failed;
    total.errors.push(...batch.errors);
    if (batch.claimed === 0) break;
    if (batch.claimed < (opts?.claimLimit ?? RENDER_WORKER_CLAIM_BATCH)) break;
  }

  return total;
}

function resolveWorkerBaseUrl(): string | null {
  const externalWorker = process.env.AUTOSCALE_RENDER_WORKER_URL?.trim();
  if (externalWorker) return externalWorker.replace(/\/$/, "");
  if (process.env.VERCEL_URL) return `https://${process.env.VERCEL_URL}`;
  const appUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
  if (appUrl) return appUrl.replace(/\/$/, "");
  if (process.env.NODE_ENV === "development") return "http://localhost:3000";
  return null;
}

function resolveCronSecret(): string | null {
  return (
    process.env.AUTOSCALE_RENDER_WORKER_SECRET?.trim() ||
    process.env.AUTOSCALE_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

/** Fire-and-forget HTTP kick — used after orchestrator enqueue. */
export function kickRenderWorker(growthRunId?: string): void {
  const base = resolveWorkerBaseUrl();
  const secret = resolveCronSecret();
  if (!base || !secret) {
    if (
      process.env.NODE_ENV === "development" ||
      process.env.AUTOSCALE_RENDER_WORKER_LOCAL === "1"
    ) {
      kickRenderWorkerInProcess(growthRunId);
    }
    return;
  }

  const externalWorker = Boolean(process.env.AUTOSCALE_RENDER_WORKER_URL?.trim());
  const url = new URL(externalWorker ? "/run" : "/api/cron/render-worker", base);
  if (growthRunId) url.searchParams.set("growthRunId", growthRunId);

  void fetch(url.toString(), {
    method: "POST",
    headers: {
      Authorization: `Bearer ${secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ growthRunId }),
  }).catch(() => undefined);
}

/** In-process worker kick for dev progress polling (no cron secret required). */
export function kickRenderWorkerInProcess(growthRunId?: string): void {
  void runRenderWorkerUntilIdle({ growthRunId }).catch((err) => {
    console.error("[render-worker] in-process batch failed:", err);
  });
}

/**
 * Wait until all jobs for a run reach a terminal state or timeout.
 * Used by synchronous `renderVideosForRun` compatibility path.
 */
export async function waitForRenderJobsTerminal(
  growthRunId: string,
  opts?: { timeoutMs?: number; pollMs?: number; client?: Client }
): Promise<void> {
  const client = opts?.client ?? createSupabaseAdminClient();
  const timeoutMs = opts?.timeoutMs ?? 30 * 60_000;
  const pollMs = opts?.pollMs ?? 3_000;
  const deadline = Date.now() + timeoutMs;

  while (Date.now() < deadline) {
    const batch = await runRenderWorkerUntilIdle({ growthRunId, client, maxBatches: 2 });
    if (batch.claimed > 0) continue;

    const { data: jobs } = await client
      .from("video_production_jobs")
      .select("status, current_stage")
      .eq("growth_run_id", growthRunId);

    const rows = jobs ?? [];
    const pending = rows.some(
      (j) =>
        j.status === "queued" ||
        j.status === "assembling" ||
        j.status === "generating_assets" ||
        j.status === "generating_audio" ||
        j.status === "uploading" ||
        j.status === "quality_check"
    );
    if (!pending) return;

    await new Promise((r) => setTimeout(r, pollMs));
  }

  throw new Error("Render worker timed out waiting for production jobs to finish.");
}
