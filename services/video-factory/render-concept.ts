import "server-only";

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { synthesizeVoiceoverWithMeta } from "./voiceover";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import { buildSrtFromScenes } from "./subtitles";
import { assembleVideoToBuffer } from "./assembler";
import { uploadGrowthMedia } from "./storage";
import { getRenderProfile } from "./render-profiles";
import { upsertPlatformVariants } from "./platform-variants";
import { checkSlideQuality } from "./slide-quality";
import { deriveSceneDurationsFromAlignment } from "./scene-timing";
import { scoreVideo, passesQualityGate } from "@/services/video-quality/score";
import type { VideoQualityScore } from "@/services/video-quality/score";
import { isVoiceoverTtsConfigured } from "@/services/voiceover/provider";
import { persistVideoQualityScore } from "@/services/video-quality/persist";
import type { SceneContract } from "./scene-contract";
import { roleToPurpose } from "./scene-contract";
import {
  audioModeUsesMusic,
  audioModeUsesVoiceover,
  resolveProductionOptions,
} from "./production-options";
import {
  backgroundMusicVolumeForMode,
  selectBackgroundMusicPath,
  shouldDuckMusicUnderVoice,
} from "./audio-mix";
import { createCaptionPages, charsToTimedWords, wordsFromSceneDurations } from "./captions/paging";
import { formatAssCaptions, pagesToSrt } from "./captions/export-ass";
import { saveRenderCheckpoint } from "./production-job";
import { GrowthRunOptionsSchema } from "@/services/growth-run/schema";
import { renderSceneVisual } from "./scene-render";
import { isFalConfigured } from "@/services/media/fal-config";

/**
 * Render one concept end-to-end: voiceover → scene assets → subtitles → MP4.
 * Sets videos.status to "ready" only when quality gate and render checks pass.
 */
/** Max Seedance fal generations per concept (not per run). */
const FAL_SCENES_PER_CONCEPT_CAP = 3;

export async function renderConceptVideo(opts: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  videoId: string;
  finalAssetId: string;
  jobId?: string;
  demoClipUrl?: string | null;
}): Promise<{
  publicUrl: string;
  partialFailures?: string[];
  qualityPassed: boolean;
  qualityScore?: VideoQualityScore;
  qualityBlockReason?: string | null;
}> {
  const ffmpeg = checkFfmpegHealth();
  if (!ffmpeg.available) {
    throw new Error(ffmpeg.message + (ffmpeg.fixHint ? ` ${ffmpeg.fixHint}` : ""));
  }

  const supabase = createSupabaseServerClient();
  const { data: concept } = await supabase
    .from("video_concepts")
    .select("id, platform, video_type, target_length_seconds, hook, cta, production_mode, growth_run_id, demo_clip_url, render_approved")
    .eq("id", opts.conceptId)
    .single();
  if (!concept) throw new Error("concept not found");
  if (concept.render_approved === false) {
    throw new Error("concept not approved for render");
  }

  const brandConstraints = await supabase
    .from("growth_runs")
    .select("brand_constraints, options")
    .eq("id", opts.growthRunId)
    .maybeSingle();
  const runOptionsRaw = brandConstraints.data?.options;
  const runOptions =
    runOptionsRaw && typeof runOptionsRaw === "object" && !Array.isArray(runOptionsRaw)
      ? GrowthRunOptionsSchema.partial().parse(runOptionsRaw)
      : {};
  const { audioMode, productionFormat, falRenderMode, falModelTier, visualPipeline } = resolveProductionOptions({
    productionFormat: runOptions.production_format ?? null,
    audioMode: runOptions.audio_mode ?? null,
    falRenderMode: runOptions.fal_render_mode ?? null,
    falModelTier: runOptions.fal_model_tier ?? null,
    visualPipeline: runOptions.visual_pipeline ?? null,
    falConfigured: isFalConfigured(),
  });

  const brandConstraintsObj =
    (brandConstraints.data?.brand_constraints as Record<string, unknown> | null) ?? null;
  const brandColor =
    brandConstraintsObj?.primary_color ?? brandConstraintsObj?.brand_color ?? null;
  const productScreenshotUrl =
    typeof brandConstraintsObj?.product_screenshot_url === "string"
      ? brandConstraintsObj.product_screenshot_url
      : null;

  const { data: script } = await supabase
    .from("video_scripts")
    .select("voiceover_full")
    .eq("concept_id", opts.conceptId)
    .maybeSingle();

  const { data: storyboard } = await supabase
    .from("storyboards")
    .select("id, aspect_ratio, total_duration_seconds")
    .eq("concept_id", opts.conceptId)
    .maybeSingle();
  if (!storyboard) throw new Error("storyboard not found");

  const { data: scenes } = await supabase
    .from("storyboard_scenes")
    .select("*")
    .eq("storyboard_id", storyboard.id)
    .order("scene_index");
  if (!scenes?.length) throw new Error("no storyboard scenes");

  const workDir = await mkdtemp(join(tmpdir(), "autoscale-render-"));
  const sceneFiles: Array<{ filePath: string; kind: "image" | "video"; durationSeconds: number }> = [];
  const partialFailures: string[] = [];

  const checkpoint = async (phase: Parameters<typeof saveRenderCheckpoint>[1], extra?: Record<string, unknown>) => {
    if (!opts.jobId) return;
    await saveRenderCheckpoint(opts.jobId, phase === "upload" ? "done" : phase, {
      conceptId: opts.conceptId,
      ...extra,
    });
  };

  const timingSource = { value: "storyboard" as "alignment" | "storyboard" };

  const { data: brief } = await supabase
    .from("product_briefs")
    .select("product_summary, target_customer")
    .eq("project_id", opts.projectId)
    .maybeSingle();

  const { data: receiptRow } = await supabase
    .from("trend_receipts")
    .select("strategic_inference, confidence, missing_evidence")
    .eq("concept_id", opts.conceptId)
    .maybeSingle();
  const trendInference = Array.isArray(receiptRow?.strategic_inference)
    ? (receiptRow!.strategic_inference as string[]).join("; ")
    : "";

  try {
    let sceneDurations = scenes.map((sc) => Math.max(0.5, Number(sc.duration_seconds)));
    const storyboardDuration = sceneDurations.reduce((sum, d) => sum + d, 0);
    let voiceResult: Awaited<ReturnType<typeof synthesizeVoiceoverWithMeta>> | null = null;
    let voicePath: string | undefined;

    await checkpoint("audio");
    if (audioModeUsesVoiceover(audioMode)) {
      if (!isVoiceoverTtsConfigured()) {
        throw new Error(
          "Voiceover required but no TTS provider configured — set ELEVENLABS_API_KEY or OPENAI_API_KEY"
        );
      }
      voiceResult = await synthesizeVoiceoverWithMeta({
        scriptText: script?.voiceover_full ?? "",
        durationSeconds: Math.max(1, Math.round(storyboardDuration)),
      });
      if (voiceResult.isSilent) {
        throw new Error(
          `Voiceover synthesis returned silent audio — ${formatVoiceoverAttemptSummary(voiceResult.attemptLog)}`
        );
      }

      if (voiceResult.alignment) {
        const derived = deriveSceneDurationsFromAlignment(scenes, voiceResult.alignment);
        if (derived) {
          sceneDurations = derived;
          timingSource.value = "alignment";
        }
      }

      const voiceBuf = voiceResult.buffer;
      voicePath = join(workDir, "voiceover.m4a");
      await writeFile(voicePath, voiceBuf);

      const { storagePath: voiceStorage, publicUrl: voiceUrl } = await uploadGrowthMedia({
        projectId: opts.projectId,
        growthRunId: opts.growthRunId,
        conceptId: opts.conceptId,
        filename: "voiceover.m4a",
        body: voiceBuf,
        contentType: "audio/mp4",
      });
      await supabase
        .from("generated_assets")
        .update({
          status: "succeeded",
          storage_path: voiceStorage,
          public_url: voiceUrl,
          provider: voiceResult.provider,
          error: null,
          metadata: {
            is_silent: false,
            quality_penalty: voiceResult.qualityPenalty,
            attempt_log: voiceResult.attemptLog,
            audio_mode: audioMode,
            timing_source: voiceResult.alignment ? "alignment" : "storyboard",
          } as never,
        })
        .eq("concept_id", opts.conceptId)
        .eq("kind", "voiceover");
    } else {
      await supabase
        .from("generated_assets")
        .update({
          status: "skipped",
          provider: "none",
          error: null,
          metadata: { audio_mode: audioMode, skipped_reason: "music_only" } as never,
        })
        .eq("concept_id", opts.conceptId)
        .eq("kind", "voiceover");
    }

    const audioSynced = audioModeUsesVoiceover(audioMode) && Boolean(voiceResult && !voiceResult.isSilent);
    for (const scene of scenes) {
      const existingMeta =
        scene.metadata && typeof scene.metadata === "object" && !Array.isArray(scene.metadata)
          ? (scene.metadata as Record<string, unknown>)
          : {};
      await supabase
        .from("storyboard_scenes")
        .update({
          metadata: {
            ...existingMeta,
            audio_synced: audioSynced,
            duration_source: timingSource.value,
          } as never,
        } as never)
        .eq("id", scene.id);
    }

    const demoClipUrl = opts.demoClipUrl ?? (concept.demo_clip_url as string | null) ?? null;
    const sceneRenderCtx = {
      supabase,
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      conceptId: opts.conceptId,
      workDir,
      aspectRatio: storyboard.aspect_ratio as string,
      brandColor: brandColor as string | null,
      hook: concept.hook,
      productSummary: brief?.product_summary ?? "SaaS product",
      targetCustomer: brief?.target_customer ?? "founders",
      trendInference,
      demoClipUrl,
      productScreenshotUrl,
      audioMode,
      falRenderMode,
      falModelTier,
      visualPipeline,
      falCount: { value: 0 },
      falScenesCap: FAL_SCENES_PER_CONCEPT_CAP,
      checkpoint: opts.jobId
        ? async (phase: string, extra?: Record<string, unknown>) => {
            await saveRenderCheckpoint(opts.jobId!, phase as Parameters<typeof saveRenderCheckpoint>[1], {
              conceptId: opts.conceptId,
              ...extra,
            });
          }
        : undefined,
    };

    await checkpoint("assets", { sceneCount: scenes.length, visualPipeline });
    for (let sceneIdx = 0; sceneIdx < scenes.length; sceneIdx++) {
      const scene = scenes[sceneIdx]!;
      const duration = sceneDurations[sceneIdx] ?? Math.max(0.5, Number(scene.duration_seconds));
      const { sceneFile, partialFailure } = await renderSceneVisual(sceneRenderCtx, scene, duration);
      sceneFiles.push(sceneFile);
      if (partialFailure) {
        console.log(`[render] ${partialFailure}`);
        partialFailures.push(partialFailure);
      }
    }

    const totalDuration = Math.max(
      1,
      Math.round(sceneDurations.reduce((sum, d) => sum + d, 0) || storyboard.total_duration_seconds)
    );

    await checkpoint("subs");
    let srt: string;
    let assPath: string | undefined;
    if (voiceResult?.alignment && audioModeUsesVoiceover(audioMode)) {
      const words = charsToTimedWords(voiceResult.alignment);
      const pages = createCaptionPages(words);
      const ass = formatAssCaptions(pages, { karaoke: true });
      assPath = join(workDir, "subs.ass");
      await writeFile(assPath, ass, "utf8");
      srt = pagesToSrt(pages);
      await supabase.from("generated_assets").insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        concept_id: opts.conceptId,
        kind: "caption_ass",
        status: "succeeded",
        metadata: { pages: pages.length, source: "elevenlabs_alignment" } as never,
      } as never);
    } else {
      srt = buildSrtFromScenes(scenes);
      const sceneWords = wordsFromSceneDurations(
        scenes.map((sc, idx) => ({
          text: (sc.subtitle_text ?? sc.voiceover_line ?? "") as string,
          durationSeconds: sceneDurations[idx] ?? Number(sc.duration_seconds),
        }))
      );
      const pages = createCaptionPages(sceneWords);
      if (pages.length) {
        const ass = formatAssCaptions(pages, { karaoke: false });
        assPath = join(workDir, "subs.ass");
        await writeFile(assPath, ass, "utf8");
      }
    }
    const srtPath = join(workDir, "subs.srt");
    await writeFile(srtPath, srt, "utf8");
    await uploadGrowthMedia({
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      conceptId: opts.conceptId,
      filename: "subtitles.srt",
      body: Buffer.from(srt, "utf8"),
      contentType: "application/x-subrip",
    });
    await supabase
      .from("generated_assets")
      .update({ status: "succeeded" })
      .eq("concept_id", opts.conceptId)
      .eq("kind", "subtitle");

    const profile = getRenderProfile(concept.platform);

    await checkpoint("assemble");
    const bgmPath = audioModeUsesMusic(audioMode)
      ? selectBackgroundMusicPath({ seed: opts.conceptId, productionFormat })
      : null;

    const mp4Buf = await assembleVideoToBuffer({
      scenes: sceneFiles,
      voiceoverPath: voicePath,
      subtitlesPath: srtPath,
      assSubtitlesPath: assPath,
      backgroundMusicPath: bgmPath ?? undefined,
      backgroundMusicVolume: backgroundMusicVolumeForMode(audioMode),
      duckMusicUnderVoice: shouldDuckMusicUnderVoice(audioMode),
      width: profile.width,
      height: profile.height,
    });

    const { storagePath: videoStorage, publicUrl } = await uploadGrowthMedia({
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      conceptId: opts.conceptId,
      filename: "final.mp4",
      body: mp4Buf,
      contentType: "video/mp4",
    });

    await supabase
      .from("generated_assets")
      .update({
        status: "succeeded",
        storage_path: videoStorage,
        public_url: publicUrl,
        duration_seconds: totalDuration,
      })
      .eq("id", opts.finalAssetId);

    const sceneContracts: SceneContract[] = scenes.map((sc, idx) => ({
      order: sc.scene_index,
      scene_type: String(sc.scene_type ?? concept.production_mode ?? "fast_slides"),
      purpose: (sc.purpose as SceneContract["purpose"]) ?? roleToPurpose(sc.role),
      visual_method: (sc.visual_method as SceneContract["visual_method"]) ?? "slide",
      voiceover_text: sc.voiceover_line ?? "",
      subtitle_text: sc.subtitle_text ?? sc.voiceover_line ?? "",
      overlay_text: sc.overlay_text ?? sc.on_screen_text ?? "",
      visual_prompt: sc.asset_prompt ?? sc.visual_intent ?? "",
      duration_seconds: sceneDurations[idx] ?? Number(sc.duration_seconds),
      status: "ready",
    }));

    const slideQc =
      concept.production_mode === "fast_slides" || concept.video_type === "slide"
        ? checkSlideQuality({
            scenes: sceneContracts,
            totalDurationSeconds: totalDuration,
            targetDurationSeconds: concept.target_length_seconds,
            mp4Url: publicUrl,
          })
        : null;

    const { data: receipt } = await supabase
      .from("trend_receipts")
      .select("confidence, missing_evidence")
      .eq("concept_id", opts.conceptId)
      .maybeSingle();

    const quality = scoreVideo({
      hook: concept.hook,
      cta: concept.cta ?? "",
      platform: concept.platform,
      productionMode: concept.production_mode,
      scenes: sceneContracts,
      totalDurationSeconds: totalDuration,
      targetDurationSeconds: concept.target_length_seconds,
      mp4Url: publicUrl,
      trendConfidence: receipt?.confidence != null ? Number(receipt.confidence) : null,
      missingEvidence: Array.isArray(receipt?.missing_evidence)
        ? (receipt.missing_evidence as string[])
        : [],
      slideQualityPassed: slideQc?.passed ?? null,
      silentVoiceover: voiceResult?.isSilent ?? false,
      voiceQualityPenalty: voiceResult?.qualityPenalty ?? (audioMode === "music_only" ? 0 : 0.25),
    });

    const qualityPassed =
      passesQualityGate(quality) && partialFailures.length === 0;
    const qualityBlockReason = qualityPassed
      ? null
      : partialFailures.length
        ? `Partial render failures: ${partialFailures.join("; ")}`
        : quality.block_reason;

    if (qualityPassed) {
      await supabase
        .from("videos")
        .update({
          status: "ready",
          duration_seconds: totalDuration,
        })
        .eq("id", opts.videoId);
    } else {
      await supabase
        .from("videos")
        .update({
          status: "failed",
          duration_seconds: totalDuration,
        })
        .eq("id", opts.videoId);
      await supabase
        .from("generated_assets")
        .update({
          status: "failed",
          error: qualityBlockReason ?? "Quality gate failed",
        })
        .eq("id", opts.finalAssetId);
    }

    const { data: runRow } = await supabase
      .from("growth_runs")
      .select("target_platforms")
      .eq("id", opts.growthRunId)
      .maybeSingle();
    const targetPlatforms = Array.isArray(runRow?.target_platforms)
      ? (runRow!.target_platforms as string[])
      : [concept.platform];

    await upsertPlatformVariants({
      client: supabase,
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      videoId: opts.videoId,
      conceptId: opts.conceptId,
      platform: concept.platform,
      mp4Buffer: mp4Buf,
      durationSeconds: totalDuration,
      targetPlatforms,
    });

    await checkpoint("upload", { publicUrl, partialFailures });

    await persistVideoQualityScore({
      client: supabase,
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      conceptId: opts.conceptId,
      videoId: opts.videoId,
      score: quality,
    });

    return {
      publicUrl,
      partialFailures: partialFailures.length ? partialFailures : undefined,
      qualityPassed,
      qualityScore: quality,
      qualityBlockReason,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await supabase
      .from("generated_assets")
      .update({ status: "failed", error: message })
      .eq("id", opts.finalAssetId);
    await supabase.from("videos").update({ status: "failed" }).eq("id", opts.videoId);
    throw err;
  } finally {
    await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
  }
}

function formatVoiceoverAttemptSummary(
  attemptLog: Array<{ provider: string; ok: boolean; error?: string }>
): string {
  const failed = attemptLog.filter((entry) => !entry.ok);
  if (!failed.length) return "no provider errors";
  return failed.map((entry) => `${entry.provider}: ${entry.error ?? "failed"}`).join("; ");
}
