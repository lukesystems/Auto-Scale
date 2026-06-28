import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { renderConceptVideo } from "@/services/video-factory/render-concept";
import { generateCaptionsForVideo } from "@/services/video-factory/captions";
import { uploadGrowthMedia } from "@/services/video-factory/storage";
import { renderSlidePng, sceneToSlideInput } from "@/services/video-factory/slide-renderer";
import { roleToPurpose } from "@/services/video-factory/scene-contract";
import type { SceneContract } from "@/services/video-factory/scene-contract";
import { setProductionJobStage } from "@/services/video-factory/production-job";
import { isFfmpegAvailable } from "@/services/video-factory/ffmpeg";
import type {
  ReviseHookInput,
  ReviseSceneTextInput,
} from "./schema";
export { regenerateVoiceoverWithResult, type RegenerateVoiceoverResult } from "./regenerate-voiceover";

export async function reviseHook(input: ReviseHookInput): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase
    .from("video_concepts")
    .update({ hook: input.newHook })
    .eq("id", input.conceptId);

  const { data: script } = await supabase
    .from("video_scripts")
    .select("id, body_lines, cta_line, voiceover_full")
    .eq("concept_id", input.conceptId)
    .maybeSingle();
  if (script) {
    const body = Array.isArray(script.body_lines) ? (script.body_lines as string[]) : [];
    const cta = script.cta_line ?? "";
    const voiceover = [input.newHook, ...body, cta].filter(Boolean).join(" ");
    await supabase
      .from("video_scripts")
      .update({
        hook_line: input.newHook,
        voiceover_full: voiceover,
      })
      .eq("id", script.id);
  }

  const { data: storyboard } = await supabase
    .from("storyboards")
    .select("id")
    .eq("concept_id", input.conceptId)
    .maybeSingle();
  if (storyboard) {
    await supabase
      .from("storyboard_scenes")
      .update({
        voiceover_line: input.newHook,
        overlay_text: input.newHook.split(" ").slice(0, 6).join(" "),
        subtitle_text: input.newHook,
        status: "planned",
      } as never)
      .eq("storyboard_id", storyboard.id)
      .eq("purpose", "hook");
  }
}

export async function reviseSceneText(input: ReviseSceneTextInput): Promise<void> {
  const supabase = createSupabaseServerClient();
  const patch: Record<string, string> = { status: "planned" };
  if (input.voiceoverText !== undefined) patch.voiceover_line = input.voiceoverText;
  if (input.overlayText !== undefined) patch.overlay_text = input.overlayText;
  if (input.subtitleText !== undefined) patch.subtitle_text = input.subtitleText;
  await supabase.from("storyboard_scenes").update(patch as never).eq("id", input.sceneId);
}

export async function regenerateSceneVisual(opts: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  sceneId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data: scene } = await supabase
    .from("storyboard_scenes")
    .select("*")
    .eq("id", opts.sceneId)
    .single();
  if (!scene) throw new Error("scene not found");

  const png = await renderSlidePng(
    sceneToSlideInput({
      purpose: (scene.purpose as SceneContract["purpose"]) ?? roleToPurpose(scene.role),
      role: scene.role,
      voiceover_text: scene.voiceover_line ?? "",
      subtitle_text: scene.subtitle_text ?? scene.voiceover_line ?? "",
      overlay_text: scene.overlay_text ?? scene.on_screen_text ?? "",
      visual_prompt: scene.asset_prompt ?? scene.visual_intent ?? "",
    })
  );

  const { storagePath, publicUrl } = await uploadGrowthMedia({
    projectId: opts.projectId,
    growthRunId: opts.growthRunId,
    conceptId: opts.conceptId,
    filename: `scene-${scene.scene_index}-rev.png`,
    body: png,
    contentType: "image/png",
  });

  await supabase
    .from("generated_assets")
    .update({
      status: "succeeded",
      storage_path: storagePath,
      public_url: publicUrl,
    } as never)
    .eq("concept_id", opts.conceptId)
    .eq("scene_id", opts.sceneId)
    .eq("kind", "slide_image");

  await supabase
    .from("storyboard_scenes")
    .update({ status: "ready" } as never)
    .eq("id", opts.sceneId);
}

export async function regenerateVoiceover(opts: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  durationSeconds: number;
}): Promise<void> {
  const { regenerateVoiceoverWithResult } = await import("./regenerate-voiceover");
  const result = await regenerateVoiceoverWithResult({
    projectId: opts.projectId,
    conceptId: opts.conceptId,
  });
  if (!result.ok) throw new Error(result.error);
}

export async function regenerateCaptions(opts: {
  videoId: string;
  conceptId: string;
  projectId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data: concept } = await supabase
    .from("video_concepts")
    .select("platform")
    .eq("id", opts.conceptId)
    .single();
  const { data: accounts } = await supabase
    .from("connected_accounts")
    .select("id, platform, handle, persona")
    .eq("project_id", opts.projectId)
    .eq("status", "active");
  const platformAccounts = (accounts ?? [])
    .filter((a) => a.platform === concept?.platform)
    .map((a) => ({
      id: a.id,
      platform: a.platform as "tiktok" | "instagram" | "youtube",
      handle: a.handle,
      persona: a.persona,
    }));
  if (!platformAccounts.length) return;
  await supabase.from("video_captions").delete().eq("video_id", opts.videoId);
  await generateCaptionsForVideo({
    videoId: opts.videoId,
    conceptId: opts.conceptId,
    projectId: opts.projectId,
    accounts: platformAccounts,
  });
}

export async function rerenderVideo(opts: {
  projectId: string;
  growthRunId: string;
  videoId: string;
  conceptId: string;
}): Promise<void> {
  if (!isFfmpegAvailable()) {
    throw new Error("ffmpeg is not available — cannot rerender");
  }
  const supabase = createSupabaseServerClient();
  const { data: video } = await supabase
    .from("videos")
    .select("final_asset_id")
    .eq("id", opts.videoId)
    .single();
  if (!video?.final_asset_id) throw new Error("video missing final asset");

  const { data: job } = await supabase
    .from("video_production_jobs")
    .select("id")
    .eq("video_id", opts.videoId)
    .maybeSingle();

  if (job?.id) {
    await setProductionJobStage(job.id, "assembling", "rerender");
  }

  await supabase.from("videos").update({ status: "rendering" }).eq("id", opts.videoId);

  await renderConceptVideo({
    projectId: opts.projectId,
    growthRunId: opts.growthRunId,
    conceptId: opts.conceptId,
    videoId: opts.videoId,
    finalAssetId: video.final_asset_id,
  });

  if (job?.id) {
    await setProductionJobStage(job.id, "quality_check", "quality_check");
    await setProductionJobStage(job.id, "ready", "ready");
  }
}
