import "server-only";

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { synthesizeVoiceoverWithMeta } from "@/services/video-factory/voiceover";
import { uploadGrowthMedia } from "@/services/video-factory/storage";
import { assembleVideoToBuffer } from "@/services/video-factory/assembler";
import { buildSrtFromScenes } from "@/services/video-factory/subtitles";
import { getRenderProfile } from "@/services/video-factory/render-profiles";
import { isFfmpegAvailable } from "@/services/video-factory/ffmpeg";
import { scoreVideo } from "@/services/video-quality/score";
import { persistVideoQualityScore } from "@/services/video-quality/persist";
import { upsertPlatformVariants } from "@/services/video-factory/platform-variants";
import type { VoiceProviderId } from "@/services/voiceover/provider";

export type RegenerateVoiceoverResult =
  | {
      ok: true;
      provider: VoiceProviderId;
      isSilent: boolean;
      publicUrl: string;
      attemptLog: Array<{ provider: VoiceProviderId; ok: boolean; error?: string }>;
      reassembled: boolean;
    }
  | { ok: false; error: string };

function formatVoiceoverAttemptSummary(
  attemptLog: Array<{ provider: string; ok: boolean; error?: string }>
): string {
  const failed = attemptLog.filter((entry) => !entry.ok);
  if (!failed.length) return "no provider errors";
  return failed.map((entry) => `${entry.provider}: ${entry.error ?? "failed"}`).join("; ");
}

async function downloadToFile(url: string, path: string): Promise<void> {
  const res = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!res.ok) throw new Error(`asset download failed: HTTP ${res.status}`);
  await writeFile(path, Buffer.from(await res.arrayBuffer()));
}

export async function regenerateVoiceoverWithResult(opts: {
  projectId: string;
  videoId?: string;
  conceptId?: string;
}): Promise<RegenerateVoiceoverResult> {
  if (!opts.videoId && !opts.conceptId) {
    return { ok: false, error: "videoId or conceptId is required" };
  }

  const supabase = createSupabaseServerClient();

  let conceptId = opts.conceptId;
  let growthRunId: string | null = null;
  let videoId = opts.videoId ?? null;
  let finalAssetId: string | null = null;
  let durationSeconds: number | null = null;

  if (opts.videoId) {
    const { data: video } = await supabase
      .from("videos")
      .select("id, concept_id, growth_run_id, final_asset_id, duration_seconds")
      .eq("id", opts.videoId)
      .eq("project_id", opts.projectId)
      .maybeSingle();
    if (!video?.concept_id || !video.growth_run_id) {
      return { ok: false, error: "video not found" };
    }
    conceptId = video.concept_id;
    growthRunId = video.growth_run_id;
    videoId = video.id;
    finalAssetId = video.final_asset_id;
    durationSeconds = video.duration_seconds;
  }

  if (!conceptId) {
    return { ok: false, error: "concept not found" };
  }

  if (!growthRunId) {
    const { data: concept } = await supabase
      .from("video_concepts")
      .select("growth_run_id")
      .eq("id", conceptId)
      .eq("project_id", opts.projectId)
      .maybeSingle();
    growthRunId = concept?.growth_run_id ?? null;
  }

  if (!growthRunId) {
    return { ok: false, error: "growth run not found for concept" };
  }

  if (!videoId) {
    const { data: video } = await supabase
      .from("videos")
      .select("id, final_asset_id, duration_seconds")
      .eq("concept_id", conceptId)
      .eq("growth_run_id", growthRunId)
      .maybeSingle();
    if (video) {
      videoId = video.id;
      finalAssetId = video.final_asset_id;
      durationSeconds = video.duration_seconds;
    }
  }

  const { data: script } = await supabase
    .from("video_scripts")
    .select("voiceover_full")
    .eq("concept_id", conceptId)
    .maybeSingle();

  const { data: storyboard } = await supabase
    .from("storyboards")
    .select("id, total_duration_seconds")
    .eq("concept_id", conceptId)
    .maybeSingle();

  const { data: scenes } = storyboard
    ? await supabase
        .from("storyboard_scenes")
        .select("id, scene_index, duration_seconds, voiceover_line, on_screen_text, subtitle_text")
        .eq("storyboard_id", storyboard.id)
        .order("scene_index")
    : { data: null };

  const totalDuration = Math.max(
    1,
    Math.round(
      script?.voiceover_full
        ? (scenes ?? []).reduce((s, sc) => s + Number(sc.duration_seconds), 0)
        : (storyboard?.total_duration_seconds ?? durationSeconds ?? 22)
    )
  );

  const voiceResult = await synthesizeVoiceoverWithMeta({
    scriptText: script?.voiceover_full ?? "",
    durationSeconds: totalDuration,
  });

  const { storagePath, publicUrl } = await uploadGrowthMedia({
    projectId: opts.projectId,
    growthRunId,
    conceptId,
    filename: "voiceover.m4a",
    body: voiceResult.buffer,
    contentType: "audio/mp4",
  });

  await supabase
    .from("generated_assets")
    .update({
      status: "succeeded",
      storage_path: storagePath,
      public_url: publicUrl,
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
    .eq("concept_id", conceptId)
    .eq("kind", "voiceover");

  let reassembled = false;

  if (videoId && finalAssetId && isFfmpegAvailable() && scenes?.length) {
    const { data: slideAssets } = await supabase
      .from("generated_assets")
      .select("scene_id, public_url, status")
      .eq("concept_id", conceptId)
      .eq("kind", "slide_image")
      .eq("status", "succeeded");

    const slideByScene = new Map(
      (slideAssets ?? [])
        .filter((a) => a.public_url && a.scene_id)
        .map((a) => [a.scene_id as string, a.public_url as string])
    );

    const sceneFiles: Array<{ filePath: string; kind: "image" | "video"; durationSeconds: number }> = [];
    const workDir = await mkdtemp(join(tmpdir(), "autoscale-vo-reasm-"));

    try {
      for (const scene of scenes) {
        const url = slideByScene.get(scene.id);
        if (!url) continue;
        const filePath = join(workDir, `scene-${scene.scene_index}.png`);
        await downloadToFile(url, filePath);
        sceneFiles.push({
          filePath,
          kind: "image",
          durationSeconds: Math.max(0.5, Number(scene.duration_seconds)),
        });
      }

      if (sceneFiles.length === scenes.length) {
        const voicePath = join(workDir, "voiceover.m4a");
        await writeFile(voicePath, voiceResult.buffer);

        const srt = buildSrtFromScenes(scenes);
        const srtPath = join(workDir, "subs.srt");
        await writeFile(srtPath, srt, "utf8");

        const { data: concept } = await supabase
          .from("video_concepts")
          .select("platform, hook, cta, production_mode, target_length_seconds")
          .eq("id", conceptId)
          .single();

        const profile = getRenderProfile(concept?.platform ?? "tiktok");
        const mp4Buf = await assembleVideoToBuffer({
          scenes: sceneFiles,
          voiceoverPath: voicePath,
          subtitlesPath: srtPath,
          width: profile.width,
          height: profile.height,
        });

        const { storagePath: videoStorage, publicUrl: mp4Url } = await uploadGrowthMedia({
          projectId: opts.projectId,
          growthRunId,
          conceptId,
          filename: "final.mp4",
          body: mp4Buf,
          contentType: "video/mp4",
        });

        await supabase
          .from("generated_assets")
          .update({
            status: "succeeded",
            storage_path: videoStorage,
            public_url: mp4Url,
            duration_seconds: totalDuration,
          })
          .eq("id", finalAssetId);

        const { data: receipt } = await supabase
          .from("trend_receipts")
          .select("confidence, missing_evidence")
          .eq("concept_id", conceptId)
          .maybeSingle();

        const quality = scoreVideo({
          hook: concept?.hook ?? "",
          cta: concept?.cta ?? "",
          platform: concept?.platform ?? "tiktok",
          productionMode: concept?.production_mode ?? null,
          scenes: [],
          totalDurationSeconds: totalDuration,
          targetDurationSeconds: concept?.target_length_seconds ?? totalDuration,
          mp4Url,
          trendConfidence: receipt?.confidence != null ? Number(receipt.confidence) : null,
          missingEvidence: Array.isArray(receipt?.missing_evidence)
            ? (receipt.missing_evidence as string[])
            : [],
          slideQualityPassed: null,
          silentVoiceover: voiceResult.isSilent,
          voiceQualityPenalty: voiceResult.qualityPenalty,
        });

        await persistVideoQualityScore({
          client: supabase,
          projectId: opts.projectId,
          growthRunId,
          conceptId,
          videoId,
          score: quality,
        });

        const { data: runRow } = await supabase
          .from("growth_runs")
          .select("target_platforms")
          .eq("id", growthRunId)
          .maybeSingle();
        const targetPlatforms = Array.isArray(runRow?.target_platforms)
          ? (runRow!.target_platforms as string[])
          : [concept?.platform ?? "tiktok"];

        await upsertPlatformVariants({
          client: supabase,
          projectId: opts.projectId,
          growthRunId,
          videoId,
          conceptId,
          platform: concept?.platform ?? "tiktok",
          mp4Buffer: mp4Buf,
          durationSeconds: totalDuration,
          targetPlatforms,
        });

        reassembled = true;
      }
    } catch (err) {
      console.warn("[regenerate-voiceover] re-assembly skipped", err);
    } finally {
      await rm(workDir, { recursive: true, force: true }).catch(() => undefined);
    }
  }

  return {
    ok: true,
    provider: voiceResult.provider,
    isSilent: voiceResult.isSilent,
    publicUrl,
    attemptLog: voiceResult.attemptLog,
    reassembled,
  };
}
