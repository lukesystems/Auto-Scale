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
import { isFalConfigured } from "@/services/media/fal-config";
import { uploadGrowthMedia } from "./storage";
import { getRenderProfile } from "./render-profiles";
import { isFfmpegAvailable } from "./ffmpeg";
import { checkSlideQuality } from "./slide-quality";
import { scoreVideo } from "@/services/video-quality/score";
import { persistVideoQualityScore } from "@/services/video-quality/persist";
import type { SceneContract } from "./scene-contract";
import { roleToPurpose } from "./scene-contract";

/**
 * Render one concept end-to-end: scene assets → voiceover → subtitles → MP4.
 * Updates generated_assets rows and flips videos.status to "ready" on success.
 */
export async function renderConceptVideo(opts: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  videoId: string;
  finalAssetId: string;
}): Promise<{ publicUrl: string }> {
  const ffmpeg = checkFfmpegHealth();
  if (!ffmpeg.available) {
    throw new Error(ffmpeg.message + (ffmpeg.fixHint ? ` ${ffmpeg.fixHint}` : ""));
  }

  const supabase = createSupabaseServerClient();
  const { data: concept } = await supabase
    .from("video_concepts")
    .select("id, platform, video_type, target_length_seconds, hook, cta, production_mode, growth_run_id")
    .eq("id", opts.conceptId)
    .single();
  if (!concept) throw new Error("concept not found");

  const brandConstraints = await supabase
    .from("growth_runs")
    .select("brand_constraints")
    .eq("id", opts.growthRunId)
    .maybeSingle();
  const brandColor =
    (brandConstraints.data?.brand_constraints as Record<string, unknown> | null)?.primary_color ??
    (brandConstraints.data?.brand_constraints as Record<string, unknown> | null)?.brand_color ??
    null;

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
    for (const scene of scenes) {
      const duration = Math.max(0.5, Number(scene.duration_seconds));
      const scenePath = join(workDir, `scene-${scene.scene_index}`);

      const scenePurpose =
        (scene.purpose as SceneContract["purpose"] | null) ?? roleToPurpose(scene.role);
      const useBroll =
        scene.asset_method === "fal_clip" ||
        scene.visual_method === "ai_broll" ||
        (isFalConfigured() &&
          (concept.production_mode === "ai_broll_short" ||
            (concept.production_mode === "fast_slides" &&
              ["problem", "mechanism", "proof"].includes(scenePurpose))));

      if (useBroll) {
        const prompt =
          scene.asset_prompt ||
          buildBrollVisualPrompt({
            productSummary: brief?.product_summary ?? "SaaS product",
            scenePurpose: String(scene.purpose ?? scene.role),
            hook: concept.hook,
            audience: brief?.target_customer ?? "founders",
            tone: "professional",
            trendInference,
            overlayText: scene.overlay_text ?? scene.on_screen_text ?? undefined,
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
          const clip = await generateSeedanceClip({
            prompt,
            durationSeconds: duration,
            aspectRatio: storyboard.aspect_ratio,
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
              metadata: { source: "fal_clip", prompt } as never,
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

      const png = await renderSlidePng(
        sceneToSlideInput(
          {
            purpose: (scene.purpose as SceneContract["purpose"]) ?? roleToPurpose(scene.role),
            role: scene.role,
            voiceover_text: scene.voiceover_line ?? "",
            subtitle_text: scene.subtitle_text ?? scene.voiceover_line ?? "",
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
        script?.voiceover_full
          ? scenes.reduce((s, sc) => s + Number(sc.duration_seconds), 0)
          : storyboard.total_duration_seconds
      )
    );

    const voiceResult = await synthesizeVoiceoverWithMeta({
      scriptText: script?.voiceover_full ?? "",
      durationSeconds: totalDuration,
    });
    const voiceBuf = voiceResult.buffer;
    const voicePath = join(workDir, "voiceover.m4a");
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
        } as never,
      })
      .eq("concept_id", opts.conceptId)
      .eq("kind", "voiceover");

    const srt = buildSrtFromScenes(scenes);
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

    const mp4Buf = await assembleVideoToBuffer({
      scenes: sceneFiles,
      voiceoverPath: voicePath,
      subtitlesPath: srtPath,
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
      silentVoiceover: voiceResult.isSilent,
      voiceQualityPenalty: voiceResult.qualityPenalty,
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

    await persistVideoQualityScore({
      client: supabase,
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      conceptId: opts.conceptId,
      videoId: opts.videoId,
      score: quality,
    });

    return { publicUrl };
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
