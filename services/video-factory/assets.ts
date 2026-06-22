import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFalConfigured } from "@/services/media/fal-config";

/**
 * Per-scene asset generation.
 *
 * v1 build philosophy (per direction): slide-first. Slide scenes are rendered
 * server-side from declarative scene data via a future Satori/resvg pipeline.
 * fal/Seedance clips run only when storyboard.scene.asset_method === 'fal_clip'
 * AND fal credentials exist.
 *
 * In this first cut, asset generation creates a `generated_assets` row in
 * 'pending' status when the renderer is not yet wired, and 'succeeded' with
 * a placeholder storage path when it is. This keeps the loop alive end-to-end
 * without blocking on the pixel-level renderer landing.
 *
 * The renderer modules below have well-defined inputs/outputs so they can be
 * filled in incrementally without changing the rest of the spine.
 */

export interface SceneAssetInput {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  sceneId: string;
  role: string;
  assetMethod: "slide" | "fal_clip" | "screen_demo" | "stock" | "image" | "user_upload";
  assetPrompt: string | null;
  onScreenText: string | null;
  voiceoverLine: string | null;
  durationSeconds: number;
  aspectRatio: string;
}

export async function generateSceneAsset(input: SceneAssetInput): Promise<{ assetId: string; status: string }> {
  const supabase = createSupabaseServerClient();

  type AssetKind =
    | "slide_image"
    | "fal_clip"
    | "voiceover"
    | "subtitle"
    | "music"
    | "final_mp4"
    | "thumbnail";
  type AssetStatus = "pending" | "running" | "succeeded" | "failed" | "skipped";

  let kind: AssetKind = "slide_image";
  let provider: string | null = null;
  let status: AssetStatus = "pending";
  let errorMsg: string | null = null;
  const publicUrl: string | null = null;
  const storagePath: string | null = null;

  switch (input.assetMethod) {
    case "slide":
    case "image":
    case "stock":
    case "user_upload":
    case "screen_demo": {
      kind = "slide_image";
      provider =
        input.assetMethod === "screen_demo" ? "user_upload" : "internal_slide_renderer";
      status = "pending";
      break;
    }
    case "fal_clip": {
      kind = "fal_clip";
      provider = "fal_seedance";
      if (!isFalConfigured()) {
        status = "skipped";
        errorMsg = "fal not configured — scene downgraded; slide fallback recommended.";
      } else {
        status = "pending";
      }
      break;
    }
  }

  const { data, error } = await supabase
    .from("generated_assets")
    .insert({
      project_id: input.projectId,
      growth_run_id: input.growthRunId,
      concept_id: input.conceptId,
      scene_id: input.sceneId,
      kind,
      provider,
      storage_path: storagePath,
      public_url: publicUrl,
      duration_seconds: input.durationSeconds,
      status,
      error: errorMsg,
      metadata: {
        asset_method: input.assetMethod,
        prompt: input.assetPrompt,
        on_screen_text: input.onScreenText,
        voiceover_line: input.voiceoverLine,
        aspect_ratio: input.aspectRatio,
      } as never,
    })
    .select("id, status")
    .single();
  if (error) throw new Error(`generated_assets insert: ${error.message}`);
  return { assetId: data!.id, status: data!.status };
}

/**
 * Stub voiceover asset row — TTS provider plugs in next.
 */
export async function queueVoiceover(input: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  scriptText: string;
}): Promise<{ assetId: string }> {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("generated_assets")
    .insert({
      project_id: input.projectId,
      growth_run_id: input.growthRunId,
      concept_id: input.conceptId,
      kind: "voiceover",
      provider: "pending_tts",
      status: "pending",
      metadata: { script_chars: input.scriptText.length } as never,
    })
    .select("id")
    .single();
  if (error) throw new Error(`voiceover asset insert: ${error.message}`);
  return { assetId: data!.id };
}

/**
 * Create the final-video placeholder row.  When the assembler ships, it
 * flips status to 'succeeded' and fills storage_path/public_url.
 */
export async function queueFinalAssembly(input: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  aspectRatio: string;
  durationSeconds: number;
}): Promise<{ assetId: string; videoId: string }> {
  const supabase = createSupabaseServerClient();
  const { data: asset, error: aErr } = await supabase
    .from("generated_assets")
    .insert({
      project_id: input.projectId,
      growth_run_id: input.growthRunId,
      concept_id: input.conceptId,
      kind: "final_mp4",
      provider: "internal_assembler",
      status: "pending",
      duration_seconds: input.durationSeconds,
      metadata: { aspect_ratio: input.aspectRatio } as never,
    })
    .select("id")
    .single();
  if (aErr) throw new Error(`final asset insert: ${aErr.message}`);

  const { data: video, error: vErr } = await supabase
    .from("videos")
    .insert({
      concept_id: input.conceptId,
      growth_run_id: input.growthRunId,
      project_id: input.projectId,
      final_asset_id: asset!.id,
      duration_seconds: input.durationSeconds,
      aspect_ratio: input.aspectRatio,
      status: "rendering",
      approval_status: "pending_review",
    })
    .select("id")
    .single();
  if (vErr) throw new Error(`videos insert: ${vErr.message}`);

  return { assetId: asset!.id, videoId: video!.id };
}
