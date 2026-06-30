import "server-only";

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderSlidePng, sceneToSlideInput } from "./slide-renderer";
import { synthesizeVoiceoverWithMeta } from "./voiceover";
import { buildBrollVisualPrompt, brandSafetyCheckPrompt } from "./broll-prompt";
import { upsertPlatformVariants } from "./platform-variants";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import { buildSrtFromScenes } from "./subtitles";
import { assembleVideoToBuffer } from "./assembler";
import { generateSeedanceClip, downloadRemoteVideo } from "./fal/seedance";
import { selectFalVideoModel } from "./fal/model-router";
import { isFalConfigured } from "@/services/media/fal-config";
import { uploadGrowthMedia } from "./storage";
import { getRenderProfile } from "./render-profiles";
import { checkSlideQuality } from "./slide-quality";
import { scoreVideo } from "@/services/video-quality/score";
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
import { resolveScreenDemo } from "./screen-demo";
import { createCaptionPages, charsToTimedWords, wordsFromSceneDurations } from "./captions/paging";
import { formatAssCaptions, pagesToSrt } from "./captions/export-ass";
import { saveRenderCheckpoint } from "./production-job";
import { GrowthRunOptionsSchema } from "@/services/growth-run/schema";

/**
 * Render one concept end-to-end: scene assets → voiceover → subtitles → MP4.
 * Updates generated_assets rows and flips videos.status to "ready" on success.
 */
/** Hard cap on Seedance fal generations per growth run across all concepts. */
const FAL_CALLS_PER_RUN_CAP = 3;

export async function renderConceptVideo(opts: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  videoId: string;
  finalAssetId: string;
  jobId?: string;
  demoClipUrl?: string | null;
  /** Running count of fal calls already made in this run; mutated in-place. */
  falCallCount?: { value: number };
}): Promise<{ publicUrl: string; partialFailures?: string[] }> {
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
  const { audioMode, productionFormat, falRenderMode, falModelTier } = resolveProductionOptions({
    productionFormat: runOptions.production_format ?? null,
    audioMode: runOptions.audio_mode ?? null,
    falRenderMode: runOptions.fal_render_mode ?? null,
    falModelTier: runOptions.fal_model_tier ?? null,
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

  const checkpoint = async (phase: "assets" | "audio" | "subs" | "assemble" | "upload", extra?: Record<string, unknown>) => {
    if (!opts.jobId) return;
    await saveRenderCheckpoint(opts.jobId, phase === "upload" ? "done" : phase, {
      conceptId: opts.conceptId,
      ...extra,
    });
  };

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
    await checkpoint("assets", { sceneCount: scenes.length });
    for (const scene of scenes) {
      const duration = Math.max(0.5, Number(scene.duration_seconds));
      const scenePath = join(workDir, `scene-${scene.scene_index}`);

      const scenePurpose =
        (scene.purpose as SceneContract["purpose"] | null) ?? roleToPurpose(scene.role);
      const visualMethod = scene.visual_method as string | null;
      const isScreenDemo =
        scene.asset_method === "screen_demo" ||
        visualMethod === "screen_recording" ||
        scenePurpose === "demo";

      if (isScreenDemo) {
        const demoUrl =
          opts.demoClipUrl ??
          (concept.demo_clip_url as string | null) ??
          null;
        const demo = await resolveScreenDemo(
          {
            sourceUrl: demoUrl,
            aspectRatio: storyboard.aspect_ratio,
            durationSeconds: duration,
          },
          workDir
        );
        if (demo.isPlaceholder) {
          partialFailures.push(`Scene ${scene.scene_index}: demo clip missing — placeholder used`);
        }
        sceneFiles.push({
          filePath: demo.filePath,
          kind: demo.kind === "video" ? "video" : "image",
          durationSeconds: duration,
        });
        await supabase
          .from("storyboard_scenes")
          .update({
            status: "ready",
            error: demo.isPlaceholder ? "demo_placeholder" : null,
          } as never)
          .eq("id", scene.id);
        continue;
      }

      const falCount = opts.falCallCount ?? { value: 0 };
      const useBroll =
        scene.asset_method === "fal_clip" ||
        scene.visual_method === "ai_broll";

      if (useBroll && falCount.value >= FAL_CALLS_PER_RUN_CAP) {
        console.log(
          `[render] fal cap reached (${FAL_CALLS_PER_RUN_CAP}), falling back to slide for scene ${scene.scene_index}`
        );
        partialFailures.push(
          `Scene ${scene.scene_index}: fal cap (${FAL_CALLS_PER_RUN_CAP}) reached — rendered as slide`
        );
      }

      if (useBroll && falCount.value < FAL_CALLS_PER_RUN_CAP) {
        const { data: existingAsset } = await supabase
          .from("generated_assets")
          .select("public_url")
          .eq("concept_id", opts.conceptId)
          .eq("scene_id", scene.id)
          .eq("kind", "fal_clip")
          .eq("status", "succeeded")
          .maybeSingle();

        if (existingAsset?.public_url) {
          try {
            const videoBuf = await downloadRemoteVideo(existingAsset.public_url);
            const mp4Path = `${scenePath}.mp4`;
            await writeFile(mp4Path, videoBuf);
            sceneFiles.push({ filePath: mp4Path, kind: "video", durationSeconds: duration });
            await supabase
              .from("storyboard_scenes")
              .update({ status: "ready" } as never)
              .eq("id", scene.id);
            continue;
          } catch {
            partialFailures.push(`Scene ${scene.scene_index}: cached fal clip download failed — re-generating`);
          }
        }
        const rawPrompt = scene.asset_prompt as string | null;
      const isRawPromptTooShort = !rawPrompt || rawPrompt.length < 40;
      const prompt = isRawPromptTooShort
        ? buildBrollVisualPrompt({
            productSummary: brief?.product_summary ?? "SaaS product",
            scenePurpose: String(scene.purpose ?? scene.role),
            hook: concept.hook,
            audience: brief?.target_customer ?? "founders",
            tone: "professional",
            trendInference,
            overlayText: scene.overlay_text ?? scene.on_screen_text ?? undefined,
            durationSeconds: duration,
            aspectRatio: storyboard.aspect_ratio,
          })
        : buildBrollVisualPrompt({
            productSummary: brief?.product_summary ?? "SaaS product",
            scenePurpose: String(scene.purpose ?? scene.role),
            hook: concept.hook,
            audience: brief?.target_customer ?? "founders",
            tone: "professional",
            trendInference,
            overlayText: rawPrompt,
            durationSeconds: duration,
            aspectRatio: storyboard.aspect_ratio,
          });
        const safety = brandSafetyCheckPrompt(prompt);
        if (!safety.ok) {
          await supabase
            .from("storyboard_scenes")
            .update({
              status: "skipped",
              error: safety.reason,
              metadata: { fallback_reason: safety.reason } as never,
            } as never)
            .eq("id", scene.id);
        } else {
        try {
          falCount.value++;

          const demoClipUrl =
            opts.demoClipUrl ?? (concept.demo_clip_url as string | null) ?? null;
          let referenceImageUrl = resolveStaticReferenceImageUrl({
            demoClipUrl,
            productScreenshotUrl,
            scenePurpose,
            visualMethod: scene.visual_method as string | null,
          });

          if (!referenceImageUrl && scenePurpose === "hook" && falRenderMode === "cinematic") {
            const hookSlide = await renderSlidePng(
              sceneToSlideInput(
                {
                  purpose: scenePurpose,
                  role: scene.role,
                  voiceover_text: scene.voiceover_line ?? "",
                  subtitle_text: scene.subtitle_text ?? scene.voiceover_line ?? "",
                  overlay_text: scene.overlay_text ?? scene.on_screen_text ?? "",
                  visual_prompt: scene.asset_prompt ?? scene.visual_intent,
                },
                { aspectRatio: storyboard.aspect_ratio, brandColor: brandColor as string | null }
              )
            );
            const { publicUrl: hookSlideUrl } = await uploadGrowthMedia({
              projectId: opts.projectId,
              growthRunId: opts.growthRunId,
              conceptId: opts.conceptId,
              filename: `scene-${scene.scene_index}-hook-frame.png`,
              body: hookSlide,
              contentType: "image/png",
            });
            referenceImageUrl = hookSlideUrl;
          }

          const selectedModel = selectFalVideoModel({
            falRenderMode,
            falModelTier,
            scenePurpose,
            referenceImageUrl,
            durationSeconds: duration,
            aspectRatio: storyboard.aspect_ratio,
          });

          const clip = await generateSeedanceClip({
            prompt,
            durationSeconds: selectedModel.duration,
            aspectRatio: storyboard.aspect_ratio,
            generateAudio: !audioModeUsesVoiceover(audioMode),
            imageUrl: referenceImageUrl ?? undefined,
            modelId: selectedModel.modelId,
            resolution: selectedModel.resolution,
          });
          const videoBuf = await downloadRemoteVideo(clip.videoUrl);
          const mp4Path = `${scenePath}.mp4`;
          await writeFile(mp4Path, videoBuf);
          sceneFiles.push({ filePath: mp4Path, kind: "video", durationSeconds: duration });

          await supabase
            .from("generated_assets")
            .update({
              status: "succeeded",
              provider: "fal_seedance",
              provider_request_id: clip.requestId ?? null,
              public_url: clip.videoUrl,
              metadata: {
                source: "fal_clip",
                prompt,
                model: clip.model,
                mode: clip.mode,
                tier: selectedModel.tier,
                resolution: clip.resolution,
                reference_image_url: referenceImageUrl ?? null,
                seed: clip.seed,
              } as never,
            } as never)
            .eq("concept_id", opts.conceptId)
            .eq("scene_id", scene.id)
            .eq("kind", "fal_clip");

          await supabase
            .from("storyboard_scenes")
            .update({
              status: "ready",
              visual_method: "ai_broll",
              asset_prompt: prompt,
            } as never)
            .eq("id", scene.id);
          continue;
        } catch (brollErr) {
          const reason = brollErr instanceof Error ? brollErr.message : String(brollErr);
          partialFailures.push(`Scene ${scene.scene_index} fal fallback: ${reason}`);
          await supabase
            .from("storyboard_scenes")
            .update({
              metadata: { fallback_reason: reason } as never,
            } as never)
            .eq("id", scene.id);
          // Fall through to slide render.
        }
        }
      }

      const willHaveAssCaptions = audioModeUsesVoiceover(audioMode);
      const png = await renderSlidePng(
        sceneToSlideInput(
          {
            purpose: (scene.purpose as SceneContract["purpose"]) ?? roleToPurpose(scene.role),
            role: scene.role,
            voiceover_text: scene.voiceover_line ?? "",
            subtitle_text: willHaveAssCaptions ? "" : (scene.subtitle_text ?? scene.voiceover_line ?? ""),
            overlay_text: scene.overlay_text ?? scene.on_screen_text ?? "",
            visual_prompt: scene.asset_prompt ?? scene.visual_intent,
          },
          { aspectRatio: storyboard.aspect_ratio, brandColor: brandColor as string | null }
        )
      );
      const pngPath = `${scenePath}.png`;
      await writeFile(pngPath, png);
      sceneFiles.push({ filePath: pngPath, kind: "image", durationSeconds: duration });

      const { storagePath, publicUrl } = await uploadGrowthMedia({
        projectId: opts.projectId,
        growthRunId: opts.growthRunId,
        conceptId: opts.conceptId,
        filename: `scene-${scene.scene_index}.png`,
        body: png,
        contentType: "image/png",
      });

      await supabase
        .from("generated_assets")
        .update({
          status: "succeeded",
          storage_path: storagePath,
          public_url: publicUrl,
        })
        .eq("concept_id", opts.conceptId)
        .eq("scene_id", scene.id)
        .eq("kind", "slide_image");

      await supabase
        .from("storyboard_scenes")
        .update({ status: "ready", asset_id: null })
        .eq("id", scene.id);
    }

    const totalDuration = Math.max(
      1,
      Math.round(
        audioModeUsesVoiceover(audioMode) && script?.voiceover_full
          ? scenes.reduce((s, sc) => s + Number(sc.duration_seconds), 0)
          : scenes.reduce((s, sc) => s + Number(sc.duration_seconds), 0) ||
              storyboard.total_duration_seconds
      )
    );

    await checkpoint("audio");
    let voiceResult: Awaited<ReturnType<typeof synthesizeVoiceoverWithMeta>> | null = null;
    let voicePath: string | undefined;

    if (audioModeUsesVoiceover(audioMode)) {
      voiceResult = await synthesizeVoiceoverWithMeta({
        scriptText: script?.voiceover_full ?? "",
        durationSeconds: totalDuration,
      });
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
          error: voiceResult.isSilent
            ? `Silent fallback — ${formatVoiceoverAttemptSummary(voiceResult.attemptLog)}`
            : null,
          metadata: {
            is_silent: voiceResult.isSilent,
            quality_penalty: voiceResult.qualityPenalty,
            attempt_log: voiceResult.attemptLog,
            audio_mode: audioMode,
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
        scenes.map((sc) => ({
          text: (sc.subtitle_text ?? sc.voiceover_line ?? "") as string,
          durationSeconds: Number(sc.duration_seconds),
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

    await supabase
      .from("videos")
      .update({
        status: "ready",
        duration_seconds: totalDuration,
      })
      .eq("id", opts.videoId);

    const sceneContracts: SceneContract[] = scenes.map((sc) => ({
      order: sc.scene_index,
      scene_type: String(sc.scene_type ?? concept.production_mode ?? "fast_slides"),
      purpose: (sc.purpose as SceneContract["purpose"]) ?? roleToPurpose(sc.role),
      visual_method: (sc.visual_method as SceneContract["visual_method"]) ?? "slide",
      voiceover_text: sc.voiceover_line ?? "",
      subtitle_text: sc.subtitle_text ?? sc.voiceover_line ?? "",
      overlay_text: sc.overlay_text ?? sc.on_screen_text ?? "",
      visual_prompt: sc.asset_prompt ?? sc.visual_intent ?? "",
      duration_seconds: Number(sc.duration_seconds),
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

    return { publicUrl, partialFailures: partialFailures.length ? partialFailures : undefined };
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

function isImageUrl(url: string): boolean {
  return /\.(png|jpe?g|webp|gif)(\?|$)/i.test(url);
}

function resolveStaticReferenceImageUrl(input: {
  demoClipUrl?: string | null;
  productScreenshotUrl?: string | null;
  scenePurpose: SceneContract["purpose"];
  visualMethod?: string | null;
}): string | undefined {
  const demo = input.demoClipUrl?.trim();
  if (demo && isImageUrl(demo)) return demo;

  const screenshot = input.productScreenshotUrl?.trim();
  if (
    screenshot &&
    screenshot.startsWith("http") &&
    (input.scenePurpose === "proof" ||
      input.scenePurpose === "demo" ||
      input.visualMethod === "screenshot")
  ) {
    return screenshot;
  }

  return undefined;
}
