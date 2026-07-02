import "server-only";

import { createHash } from "node:crypto";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isFalConfigured } from "@/services/media/fal-config";
import type { VisualPipeline } from "./production-options";

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
  visualPipeline?: VisualPipeline;
}

export async function generateSceneAsset(input: SceneAssetInput): Promise<{ assetId: string; status: string }> {
  const supabase = createSupabaseServerClient();

  type AssetKind =
    | "slide_image"
    | "fal_image"
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

  const baseMetadata = {
    asset_method: input.assetMethod,
    prompt: input.assetPrompt,
    on_screen_text: input.onScreenText,
    voiceover_line: input.voiceoverLine,
    aspect_ratio: input.aspectRatio,
    visual_pipeline: input.visualPipeline ?? "t2v",
  } as const;

  const sceneAssetPayload = {
    growth_run_id: input.growthRunId,
    provider,
    storage_path: storagePath,
    public_url: publicUrl,
    duration_seconds: input.durationSeconds,
    status,
    error: errorMsg,
    metadata: baseMetadata as never,
  };

  const { data: existingSceneAsset } = await supabase
    .from("generated_assets")
    .select("id, status")
    .eq("scene_id", input.sceneId)
    .eq("kind", kind)
    .maybeSingle();

  let assetId: string;
  let assetStatus: string;

  if (existingSceneAsset?.id) {
    const { error } = await supabase
      .from("generated_assets")
      .update(sceneAssetPayload)
      .eq("id", existingSceneAsset.id);
    if (error) throw new Error(`generated_assets reset: ${error.message}`);
    assetId = existingSceneAsset.id;
    assetStatus = status;
  } else {
    const { data, error } = await supabase
      .from("generated_assets")
      .insert({
        project_id: input.projectId,
        concept_id: input.conceptId,
        scene_id: input.sceneId,
        kind,
        ...sceneAssetPayload,
      })
      .select("id, status")
      .single();
    if (error) throw new Error(`generated_assets insert: ${error.message}`);
    assetId = data!.id;
    assetStatus = data!.status;
  }

  if (
    input.assetMethod === "fal_clip" &&
    input.visualPipeline === "image_to_video" &&
    isFalConfigured() &&
    status === "pending"
  ) {
    const falImagePayload = {
      growth_run_id: input.growthRunId,
      provider: "fal_flux",
      status: "pending" as const,
      storage_path: null,
      public_url: null,
      error: null,
      duration_seconds: input.durationSeconds,
      metadata: {
        ...baseMetadata,
        pipeline_step: "frame",
      } as never,
    };
    const { data: existingFalImage } = await supabase
      .from("generated_assets")
      .select("id")
      .eq("scene_id", input.sceneId)
      .eq("kind", "fal_image")
      .maybeSingle();

    if (existingFalImage?.id) {
      await supabase.from("generated_assets").update(falImagePayload).eq("id", existingFalImage.id);
    } else {
      await supabase.from("generated_assets").insert({
        project_id: input.projectId,
        concept_id: input.conceptId,
        scene_id: input.sceneId,
        kind: "fal_image",
        ...falImagePayload,
      });
    }
  }

  return { assetId, status: assetStatus };
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
  const scriptHash = createHash("sha256").update(input.scriptText).digest("hex");
  const voiceoverPayload = {
    growth_run_id: input.growthRunId,
    provider: "pending_tts",
    status: "pending" as const,
    storage_path: null,
    public_url: null,
    error: null,
    metadata: { script_chars: input.scriptText.length, script_hash: scriptHash } as never,
  };

  const { data: existing } = await supabase
    .from("generated_assets")
    .select("id, status, public_url, metadata")
    .eq("concept_id", input.conceptId)
    .eq("kind", "voiceover")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (existing?.id) {
    const existingMeta =
      existing.metadata && typeof existing.metadata === "object" && !Array.isArray(existing.metadata)
        ? (existing.metadata as Record<string, unknown>)
        : {};
    if (
      existing.status === "succeeded" &&
      existing.public_url &&
      existingMeta.script_hash === scriptHash
    ) {
      return { assetId: existing.id };
    }
    const { error } = await supabase
      .from("generated_assets")
      .update(voiceoverPayload)
      .eq("id", existing.id);
    if (error) throw new Error(`voiceover asset reset: ${error.message}`);
    return { assetId: existing.id };
  }

  const { data, error } = await supabase
    .from("generated_assets")
    .insert({
      project_id: input.projectId,
      concept_id: input.conceptId,
      kind: "voiceover",
      ...voiceoverPayload,
    })
    .select("id")
    .single();
  if (error) throw new Error(`voiceover asset insert: ${error.message}`);
  return { assetId: data!.id };
}

/**
 * Create the final-video placeholder row.  When the assembler ships, it
 * flips status to 'succeeded' and fills storage_path/public_url.
 *
 * Idempotent on concept_id: re-renders update the existing video row and
 * reset its final_mp4 asset instead of inserting a duplicate.
 */
export async function queueFinalAssembly(input: {
  projectId: string;
  growthRunId: string;
  conceptId: string;
  aspectRatio: string;
  durationSeconds: number;
}): Promise<{ assetId: string; videoId: string }> {
  const supabase = createSupabaseServerClient();

  const createFinalAsset = async (): Promise<string> => {
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
    return asset!.id;
  };

  const resetFinalAsset = async (assetId: string): Promise<string> => {
    const { error } = await supabase
      .from("generated_assets")
      .update({
        status: "pending",
        provider: "internal_assembler",
        storage_path: null,
        public_url: null,
        error: null,
        duration_seconds: input.durationSeconds,
        metadata: { aspect_ratio: input.aspectRatio } as never,
      })
      .eq("id", assetId);
    if (error) throw new Error(`final asset reset: ${error.message}`);
    return assetId;
  };

  const resolveFinalAssetId = async (linkedAssetId: string | null): Promise<string> => {
    if (linkedAssetId) return resetFinalAsset(linkedAssetId);

    const { data: existingFinal } = await supabase
      .from("generated_assets")
      .select("id")
      .eq("concept_id", input.conceptId)
      .eq("kind", "final_mp4")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (existingFinal?.id) return resetFinalAsset(existingFinal.id);

    return createFinalAsset();
  };

  const { data: existingVideo } = await supabase
    .from("videos")
    .select("id, final_asset_id")
    .eq("concept_id", input.conceptId)
    .maybeSingle();

  if (existingVideo) {
    const assetId = await resolveFinalAssetId(existingVideo.final_asset_id);
    const { error: vErr } = await supabase
      .from("videos")
      .update({
        growth_run_id: input.growthRunId,
        final_asset_id: assetId,
        duration_seconds: input.durationSeconds,
        aspect_ratio: input.aspectRatio,
        status: "rendering",
        approval_status: "pending_review",
        approved_by: null,
        approved_at: null,
      })
      .eq("id", existingVideo.id);
    if (vErr) throw new Error(`videos update: ${vErr.message}`);
    return { assetId, videoId: existingVideo.id };
  }

  const assetId = await createFinalAsset();
  const { data: video, error: vErr } = await supabase
    .from("videos")
    .insert({
      concept_id: input.conceptId,
      growth_run_id: input.growthRunId,
      project_id: input.projectId,
      final_asset_id: assetId,
      duration_seconds: input.durationSeconds,
      aspect_ratio: input.aspectRatio,
      status: "rendering",
      approval_status: "pending_review",
    })
    .select("id")
    .single();
  if (vErr) throw new Error(`videos insert: ${vErr.message}`);

  return { assetId, videoId: video!.id };
}
