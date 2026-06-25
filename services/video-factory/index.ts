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
import { resolveProductionMode } from "./production-modes";
import {
  ensureProductionJob,
  linkStoryboardToJob,
  setProductionJobStage,
  tagAssetsWithJob,
} from "./production-job";

/**
 * Video Factory orchestrator.
 *
 * Per concept: script → storyboard → per-scene assets → voiceover → final
 * video row → per-account captions. Each stage persists immediately so a
 * partial failure doesn't lose work.
 */
export async function buildVideosForRun(opts: {
  growthRunId: string;
  projectId: string;
  conceptIds: string[];
  connectedAccountIds?: string[];
}): Promise<{ videoIds: string[]; failures: Array<{ conceptId: string; error: string }> }> {
  const accounts = await loadConnectedAccounts(opts.projectId, opts.connectedAccountIds);
  const supabase = createSupabaseServerClient();

  const videoIds: string[] = [];
  const failures: Array<{ conceptId: string; error: string }> = [];

  for (const conceptId of opts.conceptIds) {
    try {
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

      const { script } = await generateScriptForConcept({
        conceptId,
        projectId: opts.projectId,
      });

      const { storyboard, storyboardId } = await generateStoryboardForConcept({
        conceptId,
        projectId: opts.projectId,
        script,
        videoType: concept.video_type,
        productionMode,
        hook: concept.hook,
        cta: concept.cta ?? "",
        platform: concept.platform,
        targetLengthSeconds: concept.target_length_seconds,
        preferFalForBroll: ["ai_broll", "trend_remix", "ai_broll_short"].includes(
          productionMode
        ) || ["ai_broll", "trend_remix"].includes(concept.video_type),
      });

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
          aspectRatio: storyboard.aspect_ratio,
        });
      }

      await queueVoiceover({
        projectId: opts.projectId,
        growthRunId: opts.growthRunId,
        conceptId,
        scriptText: script.voiceover_full,
      });

      const { videoId, assetId: finalAssetId } = await queueFinalAssembly({
        projectId: opts.projectId,
        growthRunId: opts.growthRunId,
        conceptId,
        aspectRatio: storyboard.aspect_ratio,
        durationSeconds: Math.round(storyboard.total_duration_seconds),
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
          await setProductionJobStage(jobId, "assembling", "render");
          await renderConceptVideo({
            projectId: opts.projectId,
            growthRunId: opts.growthRunId,
            conceptId,
            videoId,
            finalAssetId,
          });
          await tagAssetsWithJob(conceptId, jobId);
          await setProductionJobStage(jobId, "quality_check", "quality_gate");
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
        await setProductionJobStage(jobId, "queued", "awaiting_ffmpeg");
      }

      // Per-account captions: only spin up captions for accounts on this
      // concept's platform.
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
