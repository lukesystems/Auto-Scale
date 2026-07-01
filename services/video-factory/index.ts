import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateScriptForConcept } from "./script";
import { generateStoryboardForConcept } from "./storyboard";
import { isFalConfigured } from "@/services/media/fal-config";
import { resolveProductionMode, normalizeProductionMode } from "./production-modes";
import type { ProductionFormat } from "./production-options";
import {
  shouldUseAiBrollForScene,
  resolveProductionModeFromFormat,
} from "./production-options";
import { loadRunProductionContext } from "./load-run-production-context";
import {
  enqueueRenderJobsForRun,
  waitForRenderJobsTerminal,
} from "./render-worker";

function preferFalForConcept(
  productionMode: ReturnType<typeof resolveProductionMode>,
  videoType: string,
  resolved: {
    renderStyle: import("./scene-render-plan").RenderStyle;
    qualityTier: import("./scene-render-plan").QualityTier;
    productionFormat?: ProductionFormat | null;
  },
  falRenderMode: "cinematic" | "fast" = "fast"
): boolean {
  if (falRenderMode === "fast") return false;
  if (
    shouldUseAiBrollForScene(
      "problem",
      resolved.renderStyle,
      resolved.qualityTier,
      isFalConfigured()
    )
  ) {
    return true;
  }
  return (
    (["ai_broll", "trend_remix", "ai_broll_short", "reference_remix"].includes(
      productionMode
    ) ||
      ["ai_broll", "trend_remix", "pain_led"].includes(videoType) ||
      productionMode === "fast_slides") &&
    isFalConfigured()
  );
}

async function loadConcept(conceptId: string) {
  const supabase = createSupabaseServerClient();
  const { data: concept, error } = await supabase
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
    await supabase
      .from("video_concepts")
      .update({ production_mode: productionMode })
      .eq("id", conceptId);
  }

  return { concept, productionMode };
}

/**
 * Stage 2 tail: script + storyboard per concept (no asset render yet).
 */
export async function buildScriptsAndStoryboardsForRun(opts: {
  projectId: string;
  conceptIds: string[];
  growthRunId?: string;
}): Promise<{
  completedConceptIds: string[];
  failures: Array<{ conceptId: string; error: string }>;
}> {
  const supabase = createSupabaseServerClient();
  const completedConceptIds: string[] = [];
  const failures: Array<{ conceptId: string; error: string }> = [];
  const runProduction = opts.growthRunId
    ? await loadRunProductionContext(opts.growthRunId, opts.projectId)
    : null;
  const productionFormat = runProduction?.resolved.productionFormat ?? null;
  const runFalRenderMode = runProduction?.resolved.falRenderMode ?? (isFalConfigured() ? "cinematic" : "fast");
  const resolvedProduction = runProduction?.resolved;

  for (const conceptId of opts.conceptIds) {
    try {
      const { data: existingBoard } = await supabase
        .from("storyboards")
        .select("id")
        .eq("concept_id", conceptId)
        .maybeSingle();
      if (existingBoard) {
        completedConceptIds.push(conceptId);
        continue;
      }

      const { concept, productionMode } = await loadConcept(conceptId);
      const format = productionFormat ?? undefined;
      const resolvedMode = format ? resolveProductionModeFromFormat(format) : productionMode;

      const { script } = await generateScriptForConcept({
        conceptId,
        projectId: opts.projectId,
      });

      await generateStoryboardForConcept({
        conceptId,
        projectId: opts.projectId,
        script,
        videoType: concept.video_type,
        productionMode: resolvedMode,
        productionFormat: format ?? null,
        creativeFormat: resolvedProduction?.creativeFormat ?? null,
        renderStyle: resolvedProduction?.renderStyle ?? null,
        qualityTier: resolvedProduction?.qualityTier ?? null,
        falRenderMode: runFalRenderMode,
        hook: concept.hook,
        cta: concept.cta ?? "",
        platform: concept.platform,
        targetLengthSeconds: concept.target_length_seconds,
        preferFalForBroll: resolvedProduction
          ? preferFalForConcept(resolvedMode, concept.video_type, resolvedProduction, runFalRenderMode)
          : preferFalForConcept(resolvedMode, concept.video_type, {
              renderStyle: "hybrid_quality",
              qualityTier: "cinematic",
              productionFormat: format,
            }, runFalRenderMode),
      });

      completedConceptIds.push(conceptId);
    } catch (err) {
      failures.push({
        conceptId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { completedConceptIds, failures };
}

async function collectRenderResults(growthRunId: string): Promise<{
  videoIds: string[];
  failures: Array<{ conceptId: string; error: string }>;
}> {
  const supabase = createSupabaseServerClient();
  const { data: videos } = await supabase
    .from("videos")
    .select("id, status, concept_id")
    .eq("growth_run_id", growthRunId);

  const { data: jobs } = await supabase
    .from("video_production_jobs")
    .select("concept_id, status, error")
    .eq("growth_run_id", growthRunId);

  const failures: Array<{ conceptId: string; error: string }> = [];
  for (const job of jobs ?? []) {
    if (job.status === "failed" && job.concept_id) {
      failures.push({
        conceptId: job.concept_id,
        error: job.error ?? "Render failed",
      });
    }
  }

  const videoIds = (videos ?? [])
    .filter((v) => v.status === "ready" || v.status === "rendering")
    .map((v) => v.id);

  return { videoIds, failures };
}

/**
 * Stage 3: enqueue async render jobs and optionally wait for worker completion.
 */
export async function renderVideosForRun(opts: {
  growthRunId: string;
  projectId: string;
  conceptIds: string[];
  connectedAccountIds?: string[];
  /** When false, return after enqueue (orchestrator default). */
  awaitCompletion?: boolean;
}): Promise<{ videoIds: string[]; failures: Array<{ conceptId: string; error: string }> }> {
  const enqueued = await enqueueRenderJobsForRun({
    growthRunId: opts.growthRunId,
    projectId: opts.projectId,
    conceptIds: opts.conceptIds,
    connectedAccountIds: opts.connectedAccountIds,
  });

  if (enqueued.jobIds.length > 0 && opts.awaitCompletion !== false) {
    await waitForRenderJobsTerminal(opts.growthRunId);
    return collectRenderResults(opts.growthRunId);
  }

  return {
    videoIds: enqueued.videoIds,
    failures: enqueued.failures,
  };
}

export { enqueueRenderJobsForRun } from "./render-worker";

/**
 * Full video factory (scripts through captions). Prefer staged
 * `buildScriptsAndStoryboardsForRun` + `renderVideosForRun` for gated runs.
 */
export async function buildVideosForRun(opts: {
  growthRunId: string;
  projectId: string;
  conceptIds: string[];
  connectedAccountIds?: string[];
}): Promise<{ videoIds: string[]; failures: Array<{ conceptId: string; error: string }> }> {
  await buildScriptsAndStoryboardsForRun({
    projectId: opts.projectId,
    conceptIds: opts.conceptIds,
    growthRunId: opts.growthRunId,
  });
  return renderVideosForRun({ ...opts, awaitCompletion: true });
}
