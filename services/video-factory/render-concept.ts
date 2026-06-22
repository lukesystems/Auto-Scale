import "server-only";

import { mkdtemp, writeFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderSlidePng } from "./slide-renderer";
import { synthesizeVoiceover } from "./voiceover";
import { buildSrtFromScenes } from "./subtitles";
import { assembleVideoToBuffer } from "./assembler";
import { generateSeedanceClip, downloadRemoteVideo } from "./fal/seedance";
import { uploadGrowthMedia } from "./storage";
import { isFfmpegAvailable } from "./ffmpeg";

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
  if (!isFfmpegAvailable()) {
    throw new Error("ffmpeg is not available — cannot render video");
  }

  const supabase = createSupabaseServerClient();
  const { data: concept } = await supabase
    .from("video_concepts")
    .select("id, platform, video_type, target_length_seconds")
    .eq("id", opts.conceptId)
    .single();
  if (!concept) throw new Error("concept not found");

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

  try {
    for (const scene of scenes) {
      const duration = Math.max(0.5, Number(scene.duration_seconds));
      const scenePath = join(workDir, `scene-${scene.scene_index}`);

      if (scene.asset_method === "fal_clip" && scene.asset_prompt) {
        try {
          const clip = await generateSeedanceClip({
            prompt: scene.asset_prompt,
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
              metadata: { source: "fal_clip" } as never,
            })
            .eq("concept_id", opts.conceptId)
            .eq("scene_id", scene.id)
            .eq("kind", "fal_clip");
          continue;
        } catch {
          // Fall through to slide render for this scene.
        }
      }

      const png = await renderSlidePng({
        onScreenText: scene.on_screen_text ?? scene.voiceover_line ?? scene.role,
        voiceoverLine: scene.voiceover_line,
        role: scene.role,
        aspectRatio: storyboard.aspect_ratio,
      });
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
    }

    const totalDuration = Math.max(
      1,
      Math.round(
        script?.voiceover_full
          ? scenes.reduce((s, sc) => s + Number(sc.duration_seconds), 0)
          : storyboard.total_duration_seconds
      )
    );

    const voiceBuf = await synthesizeVoiceover({
      scriptText: script?.voiceover_full ?? "",
      durationSeconds: totalDuration,
    });
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

    const mp4Buf = await assembleVideoToBuffer({
      scenes: sceneFiles,
      voiceoverPath: voicePath,
      subtitlesPath: srtPath,
      width: storyboard.aspect_ratio === "16:9" ? 1920 : 1080,
      height: storyboard.aspect_ratio === "16:9" ? 1080 : 1920,
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
