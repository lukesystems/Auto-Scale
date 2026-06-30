import "server-only";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import { renderSlidePng, sceneToSlideInput } from "./slide-renderer";
import { buildBrollVisualPrompt, buildSceneFramePrompt, brandSafetyCheckPrompt } from "./broll-prompt";
import { generateSeedanceClip, downloadRemoteVideo } from "./fal/seedance";
import { generateFalImage } from "./fal/image-gen";
import { selectFalImageModel, selectFalVideoModel } from "./fal/model-router";
import { uploadGrowthMedia } from "./storage";
import { resolveScreenDemo } from "./screen-demo";
import type { SceneContract } from "./scene-contract";
import { roleToPurpose } from "./scene-contract";
import type { AudioMode, FalModelTier, FalRenderMode, VisualPipeline } from "./production-options";
import { audioModeUsesVoiceover } from "./production-options";
import { sceneVisualCheckpoint } from "./production-job";

export interface SceneRow {
  id: string;
  scene_index: number;
  role: string;
  purpose?: string | null;
  asset_method?: string | null;
  visual_method?: string | null;
  asset_prompt?: string | null;
  visual_intent?: string | null;
  voiceover_line?: string | null;
  subtitle_text?: string | null;
  overlay_text?: string | null;
  on_screen_text?: string | null;
  duration_seconds: number;
  metadata?: unknown;
}

export interface SceneRenderContext {
  supabase: SupabaseClient;
  projectId: string;
  growthRunId: string;
  conceptId: string;
  workDir: string;
  aspectRatio: string;
  brandColor: string | null;
  hook: string;
  productSummary: string;
  targetCustomer: string;
  trendInference: string;
  demoClipUrl: string | null;
  productScreenshotUrl: string | null;
  audioMode: AudioMode;
  falRenderMode: FalRenderMode;
  falModelTier: FalModelTier;
  visualPipeline: VisualPipeline;
  falCount: { value: number };
  falScenesCap: number;
  checkpoint?: (phase: string, extra?: Record<string, unknown>) => Promise<void>;
}

export interface SceneFileResult {
  filePath: string;
  kind: "image" | "video";
  durationSeconds: number;
}

export interface SceneRenderOutput {
  sceneFile: SceneFileResult;
  partialFailure?: string;
  sceneMetadata: Record<string, unknown>;
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

function brollPromptInput(
  ctx: SceneRenderContext,
  scene: SceneRow,
  duration: number,
  rawPrompt: string | null
) {
  return {
    productSummary: ctx.productSummary,
    scenePurpose: String(scene.purpose ?? scene.role),
    hook: ctx.hook,
    audience: ctx.targetCustomer,
    tone: "professional" as const,
    trendInference: ctx.trendInference,
    overlayText: rawPrompt ?? scene.overlay_text ?? scene.on_screen_text ?? undefined,
    durationSeconds: duration,
    aspectRatio: ctx.aspectRatio,
  };
}

async function renderSlideScene(
  ctx: SceneRenderContext,
  scene: SceneRow,
  duration: number,
  scenePath: string,
  willHaveAssCaptions: boolean
): Promise<SceneFileResult> {
  const png = await renderSlidePng(
    sceneToSlideInput(
      {
        purpose: (scene.purpose as SceneContract["purpose"]) ?? roleToPurpose(scene.role),
        role: scene.role,
        voiceover_text: scene.voiceover_line ?? "",
        subtitle_text: willHaveAssCaptions ? "" : (scene.subtitle_text ?? scene.voiceover_line ?? ""),
        overlay_text: scene.overlay_text ?? scene.on_screen_text ?? "",
        visual_prompt: scene.asset_prompt ?? scene.visual_intent ?? "",
      },
      { aspectRatio: ctx.aspectRatio, brandColor: ctx.brandColor }
    )
  );
  const pngPath = `${scenePath}.png`;
  await writeFile(pngPath, png);

  const { storagePath, publicUrl } = await uploadGrowthMedia({
    projectId: ctx.projectId,
    growthRunId: ctx.growthRunId,
    conceptId: ctx.conceptId,
    filename: `scene-${scene.scene_index}.png`,
    body: png,
    contentType: "image/png",
  });

  await ctx.supabase
    .from("generated_assets")
    .update({
      status: "succeeded",
      storage_path: storagePath,
      public_url: publicUrl,
    })
    .eq("concept_id", ctx.conceptId)
    .eq("scene_id", scene.id)
    .eq("kind", "slide_image");

  return { filePath: pngPath, kind: "image", durationSeconds: duration };
}

async function tryFalBroll(
  ctx: SceneRenderContext,
  scene: SceneRow,
  duration: number,
  scenePath: string,
  pipeline: "t2v" | "image_to_video"
): Promise<SceneFileResult | null> {
  const { data: existingClip } = await ctx.supabase
    .from("generated_assets")
    .select("id, public_url")
    .eq("concept_id", ctx.conceptId)
    .eq("scene_id", scene.id)
    .eq("kind", "fal_clip")
    .eq("status", "succeeded")
    .maybeSingle();

  if (existingClip?.public_url) {
    try {
      const videoBuf = await downloadRemoteVideo(existingClip.public_url);
      const mp4Path = `${scenePath}.mp4`;
      await writeFile(mp4Path, videoBuf);
      return { filePath: mp4Path, kind: "video", durationSeconds: duration };
    } catch {
      // Re-generate below.
    }
  }

  const rawPrompt = scene.asset_prompt as string | null;
  const motionPrompt = buildBrollVisualPrompt(brollPromptInput(ctx, scene, duration, rawPrompt));
  const safety = brandSafetyCheckPrompt(motionPrompt);
  if (!safety.ok) {
    await ctx.supabase
      .from("storyboard_scenes")
      .update({
        status: "skipped",
        error: safety.reason,
        metadata: { fallback_reason: safety.reason } as never,
      } as never)
      .eq("id", scene.id);
    return null;
  }

  const scenePurpose =
    (scene.purpose as SceneContract["purpose"] | null) ?? roleToPurpose(scene.role);

  let falImageAssetId: string | null = null;
  let referenceImageUrl = resolveStaticReferenceImageUrl({
    demoClipUrl: ctx.demoClipUrl,
    productScreenshotUrl: ctx.productScreenshotUrl,
    scenePurpose,
    visualMethod: scene.visual_method as string | null,
  });

  if (pipeline === "image_to_video") {
    const { data: existingImage } = await ctx.supabase
      .from("generated_assets")
      .select("id, public_url")
      .eq("concept_id", ctx.conceptId)
      .eq("scene_id", scene.id)
      .eq("kind", "fal_image")
      .eq("status", "succeeded")
      .maybeSingle();

    if (existingImage?.public_url) {
      falImageAssetId = existingImage.id;
      referenceImageUrl = existingImage.public_url;
    } else {
      const framePrompt = buildSceneFramePrompt(brollPromptInput(ctx, scene, duration, rawPrompt));
      const imageModel = selectFalImageModel({
        falRenderMode: ctx.falRenderMode,
        falModelTier: ctx.falModelTier,
        scenePurpose,
      });
      const imageResult = await generateFalImage({
        prompt: framePrompt,
        aspectRatio: ctx.aspectRatio,
        modelId: imageModel.modelId,
      });
      referenceImageUrl = imageResult.imageUrl;

      const { data: imageAsset } = await ctx.supabase
        .from("generated_assets")
        .select("id")
        .eq("concept_id", ctx.conceptId)
        .eq("scene_id", scene.id)
        .eq("kind", "fal_image")
        .maybeSingle();

      if (imageAsset?.id) {
        falImageAssetId = imageAsset.id;
        await ctx.supabase
          .from("generated_assets")
          .update({
            status: "succeeded",
            provider: "fal_flux",
            provider_request_id: imageResult.requestId ?? null,
            public_url: imageResult.imageUrl,
            metadata: {
              source: "fal_image",
              prompt: framePrompt,
              model: imageResult.model,
              tier: imageModel.tier,
              pipeline_step: "frame",
            } as never,
          } as never)
          .eq("id", imageAsset.id);
      }
    }
  }

  if (!referenceImageUrl && scenePurpose === "hook" && ctx.falRenderMode === "cinematic" && pipeline === "t2v") {
    const hookSlide = await renderSlidePng(
      sceneToSlideInput(
        {
          purpose: scenePurpose,
          role: scene.role,
          voiceover_text: scene.voiceover_line ?? "",
          subtitle_text: scene.subtitle_text ?? scene.voiceover_line ?? "",
          overlay_text: scene.overlay_text ?? scene.on_screen_text ?? "",
          visual_prompt: scene.asset_prompt ?? scene.visual_intent ?? "",
        },
        { aspectRatio: ctx.aspectRatio, brandColor: ctx.brandColor }
      )
    );
    const { publicUrl: hookSlideUrl } = await uploadGrowthMedia({
      projectId: ctx.projectId,
      growthRunId: ctx.growthRunId,
      conceptId: ctx.conceptId,
      filename: `scene-${scene.scene_index}-hook-frame.png`,
      body: hookSlide,
      contentType: "image/png",
    });
    referenceImageUrl = hookSlideUrl;
  }

  const selectedModel = selectFalVideoModel({
    falRenderMode: ctx.falRenderMode,
    falModelTier: ctx.falModelTier,
    scenePurpose,
    referenceImageUrl,
    falImageAssetUrl: pipeline === "image_to_video" ? referenceImageUrl : null,
    durationSeconds: duration,
    aspectRatio: ctx.aspectRatio,
  });

  const clip = await generateSeedanceClip({
    prompt: motionPrompt,
    durationSeconds: selectedModel.duration,
    aspectRatio: ctx.aspectRatio,
    generateAudio: !audioModeUsesVoiceover(ctx.audioMode),
    imageUrl: referenceImageUrl ?? undefined,
    modelId: selectedModel.modelId,
    resolution: selectedModel.resolution,
  });

  const videoBuf = await downloadRemoteVideo(clip.videoUrl);
  const mp4Path = `${scenePath}.mp4`;
  await writeFile(mp4Path, videoBuf);

  const { data: clipAsset } = await ctx.supabase
    .from("generated_assets")
    .select("id")
    .eq("concept_id", ctx.conceptId)
    .eq("scene_id", scene.id)
    .eq("kind", "fal_clip")
    .maybeSingle();

  await ctx.supabase
    .from("generated_assets")
    .update({
      status: "succeeded",
      provider: "fal_seedance",
      provider_request_id: clip.requestId ?? null,
      public_url: clip.videoUrl,
      metadata: {
        source: "fal_clip",
        prompt: motionPrompt,
        model: clip.model,
        mode: clip.mode,
        tier: selectedModel.tier,
        resolution: clip.resolution,
        reference_image_url: referenceImageUrl ?? null,
        visual_pipeline: pipeline,
        seed: clip.seed,
      } as never,
    } as never)
    .eq("concept_id", ctx.conceptId)
    .eq("scene_id", scene.id)
    .eq("kind", "fal_clip");

  await ctx.supabase
    .from("storyboard_scenes")
    .update({
      status: "ready",
      visual_method: "ai_broll",
      asset_prompt: motionPrompt,
      metadata: {
        visuals_ready: true,
        fal_image_asset_id: falImageAssetId,
        fal_clip_asset_id: clipAsset?.id ?? null,
        visual_pipeline: pipeline,
      } as never,
    } as never)
    .eq("id", scene.id);

  return { filePath: mp4Path, kind: "video", durationSeconds: duration };
}

/**
 * Render one scene's visual asset. Fallback chain for ai_broll:
 * image_to_video → t2v → slide (or t2v → slide when pipeline is t2v).
 */
export async function renderSceneVisual(
  ctx: SceneRenderContext,
  scene: SceneRow,
  duration: number
): Promise<SceneRenderOutput> {
  const scenePath = join(ctx.workDir, `scene-${scene.scene_index}`);
  await ctx.checkpoint?.(sceneVisualCheckpoint(scene.id), { sceneIndex: scene.scene_index });

  const scenePurpose =
    (scene.purpose as SceneContract["purpose"] | null) ?? roleToPurpose(scene.role);
  const visualMethod = scene.visual_method as string | null;
  const isScreenDemo =
    scene.asset_method === "screen_demo" ||
    visualMethod === "screen_recording" ||
    scenePurpose === "demo";

  if (isScreenDemo) {
    if (!ctx.demoClipUrl?.trim()) {
      throw new Error(
        `Scene ${scene.scene_index}: demo clip required for demo format — upload before render`
      );
    }
    const demo = await resolveScreenDemo(
      {
        sourceUrl: ctx.demoClipUrl,
        aspectRatio: ctx.aspectRatio,
        durationSeconds: duration,
      },
      ctx.workDir
    );
    if (demo.isPlaceholder) {
      throw new Error(
        `Scene ${scene.scene_index}: demo clip could not be loaded — check upload URL`
      );
    }
    await ctx.supabase
      .from("storyboard_scenes")
      .update({
        status: "ready",
        error: demo.isPlaceholder ? "demo_placeholder" : null,
        metadata: { visuals_ready: true } as never,
      } as never)
      .eq("id", scene.id);

    return {
      sceneFile: {
        filePath: demo.filePath,
        kind: demo.kind === "video" ? "video" : "image",
        durationSeconds: duration,
      },
      sceneMetadata: { visuals_ready: true },
    };
  }

  const useBroll =
    scene.asset_method === "fal_clip" || scene.visual_method === "ai_broll";
  const willHaveAssCaptions = audioModeUsesVoiceover(ctx.audioMode);

  if (useBroll && ctx.falCount.value >= ctx.falScenesCap) {
    const partialFailure = `Scene ${scene.scene_index}: fal cap (${ctx.falScenesCap}) reached — rendered as slide`;
    const sceneFile = await renderSlideScene(ctx, scene, duration, scenePath, willHaveAssCaptions);
    await ctx.supabase
      .from("storyboard_scenes")
      .update({
        status: "ready",
        metadata: { visuals_ready: true, fallback_reason: "fal_cap" } as never,
      } as never)
      .eq("id", scene.id);
    return { sceneFile, partialFailure, sceneMetadata: { visuals_ready: true } };
  }

  if (useBroll && ctx.falCount.value < ctx.falScenesCap) {
    ctx.falCount.value++;
    const pipeline = ctx.visualPipeline === "image_to_video" ? "image_to_video" : "t2v";

    try {
      const falResult = await tryFalBroll(ctx, scene, duration, scenePath, pipeline);
      if (falResult) {
        return { sceneFile: falResult, sceneMetadata: { visuals_ready: true } };
      }
    } catch (brollErr) {
      const reason = brollErr instanceof Error ? brollErr.message : String(brollErr);

      if (pipeline === "image_to_video") {
        try {
          const t2vResult = await tryFalBroll(ctx, scene, duration, scenePath, "t2v");
          if (t2vResult) {
            return {
              sceneFile: t2vResult,
              partialFailure: `Scene ${scene.scene_index} I2V fallback to T2V: ${reason}`,
              sceneMetadata: { visuals_ready: true, visual_pipeline: "t2v" },
            };
          }
        } catch (t2vErr) {
          const t2vReason = t2vErr instanceof Error ? t2vErr.message : String(t2vErr);
          await ctx.supabase
            .from("storyboard_scenes")
            .update({ metadata: { fallback_reason: t2vReason } as never } as never)
            .eq("id", scene.id);
        }
      } else {
        await ctx.supabase
          .from("storyboard_scenes")
          .update({ metadata: { fallback_reason: reason } as never } as never)
          .eq("id", scene.id);
      }
    }
  }

  const sceneFile = await renderSlideScene(ctx, scene, duration, scenePath, willHaveAssCaptions);
  await ctx.supabase
    .from("storyboard_scenes")
    .update({
      status: "ready",
      asset_id: null,
      metadata: { visuals_ready: true, visual_pipeline: "slide" } as never,
    } as never)
    .eq("id", scene.id);

  return { sceneFile, sceneMetadata: { visuals_ready: true, visual_pipeline: "slide" } };
}
