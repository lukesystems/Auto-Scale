import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { generateScriptForConcept } from "./script";
import { generateStoryboardForConcept } from "./storyboard";
import {
  generateSceneAsset,
  queueFinalAssembly,
  queueVoiceover,
} from "./assets";
import { generateCaptionsForVideo } from "./captions";
import { loadConnectedAccounts } from "@/services/growth-run/repository";
import { renderConceptVideo } from "./render-concept";
import { isFfmpegAvailable } from "./ffmpeg";
import { isFalConfigured } from "@/services/media/fal-config";
import { resolveProductionMode } from "./production-modes";
import type { ProductionFormat } from "./production-options";
import {
  preferAiBrollForFormat,
  resolveProductionModeFromFormat,
  resolveProductionOptions,
} from "./production-options";
import { GrowthRunOptionsSchema } from "@/services/growth-run/schema";
import {
  ensureProductionJob,
  linkStoryboardToJob,
  setProductionJobStage,
  tagAssetsWithJob,
} from "./production-job";
import { runPreRenderGate } from "./pre-render-gate";

function preferFalForConcept(
  productionMode: ReturnType<typeof resolveProductionMode>,
  videoType: string,
  productionFormat?: ProductionFormat | null,
  falRenderMode: "cinematic" | "fast" = "fast"
): boolean {
  if (falRenderMode === "fast") return false;
  if (productionFormat)
    return preferAiBrollForFormat(productionFormat, falRenderMode, isFalConfigured());
  return (
    (["ai_broll", "trend_remix", "ai_broll_short", "reference_remix"].includes(
      productionMode
    ) ||
      ["ai_broll", "trend_remix", "pain_led"].includes(videoType) ||
      productionMode === "fast_slides") &&
    isFalConfigured()
  );
}

async function loadRunFalRenderMode(growthRunId?: string): Promise<"cinematic" | "fast"> {
  if (!growthRunId) return "fast";
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("growth_runs")
    .select("options")
    .eq("id", growthRunId)
    .maybeSingle();
  if (!data?.options || typeof data.options !== "object" || Array.isArray(data.options)) {
    return "fast";
  }
  const opts = GrowthRunOptionsSchema.partial().parse(data.options);
  return opts.fal_render_mode === "cinematic" ? "cinematic" : "fast";
}

async function loadRunProductionFormat(growthRunId: string): Promise<ProductionFormat | null> {
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("growth_runs")
    .select("options")
    .eq("id", growthRunId)
    .maybeSingle();
  if (!data?.options || typeof data.options !== "object" || Array.isArray(data.options)) {
    return null;
  }
  const opts = GrowthRunOptionsSchema.partial().parse(data.options);
  return opts.production_format ?? null;
}

async function loadConcept(conceptId: string) {
  const supabase = createSupabaseServerClient();
  const { data: concept, error } = await supabase
    .from("video_concepts")
    .select("id, video_type, platform, target_length_seconds, hook, cta, production_mode")
    .eq("id", conceptId)
    .single();
  if (error || !concept) throw new Error(`concept missing: ${error?.message}`);

  const productionMode =
    (concept.production_mode as ReturnType<typeof resolveProductionMode> | null) ??
    resolveProductionMode(concept.video_type as never);
  if (!concept.production_mode) {
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
  const productionFormat = opts.growthRunId
    ? await loadRunProductionFormat(opts.growthRunId)
    : null;
  const runFalRenderMode = await loadRunFalRenderMode(opts.growthRunId);

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
        falRenderMode: runFalRenderMode,
        hook: concept.hook,
        cta: concept.cta ?? "",
        platform: concept.platform,
        targetLengthSeconds: concept.target_length_seconds,
        preferFalForBroll: preferFalForConcept(resolvedMode, concept.video_type, format, runFalRenderMode),
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

/**
 * Stage 3: per-scene assets → voiceover → render → captions.
 */
export async function renderVideosForRun(opts: {
  growthRunId: string;
  projectId: string;
  conceptIds: string[];
  connectedAccountIds?: string[];
}): Promise<{ videoIds: string[]; failures: Array<{ conceptId: string; error: string }> }> {
  const accounts = await loadConnectedAccounts(opts.projectId, opts.connectedAccountIds);
  const supabase = createSupabaseServerClient();

  const videoIds: string[] = [];
  const failures: Array<{ conceptId: string; error: string }> = [];
  const falCallCount = { value: 0 };

  for (const conceptId of opts.conceptIds) {
    try {
      const { concept, productionMode } = await loadConcept(conceptId);

      const { data: conceptRow } = await supabase
        .from("video_concepts")
        .select("render_approved, demo_clip_url, hook")
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

      const storyboardId = storyboard.id;

      const { data: scenes, error: scErr } = await supabase
        .from("storyboard_scenes")
        .select("*")
        .eq("storyboard_id", storyboardId)
        .order("scene_index");
      if (scErr) throw new Error(`scenes load: ${scErr.message}`);

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
        });
      }

      const { data: scriptRow } = await supabase
        .from("video_scripts")
        .select("voiceover_full, hook_line, body_lines, cta_line, estimated_duration_seconds")
        .eq("concept_id", conceptId)
        .maybeSingle();

      const { data: runRow } = await supabase
        .from("growth_runs")
        .select("options")
        .eq("id", opts.growthRunId)
        .maybeSingle();
      const runOpts =
        runRow?.options && typeof runRow.options === "object" && !Array.isArray(runRow.options)
          ? GrowthRunOptionsSchema.partial().parse(runRow.options)
          : {};
      const { audioMode } = resolveProductionOptions({
        productionFormat: runOpts.production_format ?? null,
        audioMode: runOpts.audio_mode ?? null,
        falRenderMode: runOpts.fal_render_mode ?? null,
      });

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
            estimated_duration_seconds: scriptRow.estimated_duration_seconds ?? concept.target_length_seconds,
          },
          targetLengthSeconds: concept.target_length_seconds,
          sceneDurationsSeconds: (scenes ?? []).map((s) => Number(s.duration_seconds)),
          audioMode,
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
      });
      await linkStoryboardToJob(storyboardId, jobId);
      await setProductionJobStage(jobId, "planning", "storyboard");
      await setProductionJobStage(jobId, "generating_assets", "scene_assets");

      if (isFfmpegAvailable()) {
        try {
          await setProductionJobStage(jobId, "generating_assets", "scene_assets");
          await setProductionJobStage(jobId, "assembling", "render");
          const renderResult = await renderConceptVideo({
            projectId: opts.projectId,
            growthRunId: opts.growthRunId,
            conceptId,
            videoId,
            finalAssetId,
            jobId,
            demoClipUrl: (conceptRow?.demo_clip_url as string | null) ?? null,
            falCallCount,
          });
          await tagAssetsWithJob(conceptId, jobId);
          await setProductionJobStage(
            jobId,
            renderResult.partialFailures?.length ? "partial" : "quality_check",
            renderResult.partialFailures?.length ? "partial_success" : "quality_gate",
            renderResult.partialFailures?.join("; ") ?? null
          );
          await setProductionJobStage(jobId, "ready", "ready");
        } catch (renderErr) {
          await setProductionJobStage(
            jobId,
            "failed",
            "render",
            renderErr instanceof Error ? renderErr.message : String(renderErr)
          );
          failures.push({
            conceptId,
            error: renderErr instanceof Error ? renderErr.message : String(renderErr),
          });
          continue;
        }
      } else {
        const error = "FFmpeg is unavailable. Stage 3 rendering cannot produce a ready MP4 in this environment.";
        await setProductionJobStage(jobId, "queued", "awaiting_ffmpeg");
        await supabase
          .from("videos")
          .update({ status: "failed" })
          .eq("id", videoId);
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

      const platformAccounts = accounts
        .filter((a) => a.platform === concept.platform)
        .map((a) => ({
          id: a.id,
          platform: a.platform,
          handle: a.handle,
          persona: a.persona,
        }));
      if (platformAccounts.length) {
        await generateCaptionsForVideo({
          videoId,
          conceptId,
          projectId: opts.projectId,
          accounts: platformAccounts,
        });
      }

      videoIds.push(videoId);
    } catch (err) {
      failures.push({
        conceptId,
        error: err instanceof Error ? err.message : String(err),
      });
    }
  }

  return { videoIds, failures };
}

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
  });
  return renderVideosForRun(opts);
}
