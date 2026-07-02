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
import type { SceneContract } from "./scene-contract";
import { roleToPurpose } from "./scene-contract";
import type { AudioMode, FalModelTier, FalRenderMode, ProductionFormat, VisualPipeline } from "./production-options";
import type { CreativeFormat, FallbackOnBadAiScene, QualityTier, RenderStyle } from "./scene-render-plan";
import {
  audioModeUsesVoiceover,
  shouldUseAiBrollForScene,
  buildSceneRenderPlan,
  sceneRenderMethodToSlideStyle,
} from "./production-options";
import { isFalConfigured } from "@/services/media/fal-config";
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
  productionFormat: ProductionFormat;
  productScreenshotUrl: string | null;
  audioMode: AudioMode;
  falRenderMode: FalRenderMode;
  falModelTier: FalModelTier;
  visualPipeline: VisualPipeline;
  falCount: { value: number };
  falScenesCap: number;
  creativeFormat: CreativeFormat;
  renderStyle: RenderStyle;
  qualityTier: QualityTier;
  fallbackOnBadAiScene: FallbackOnBadAiScene;
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

function isLegacyDemoScene(scene: SceneRow): boolean {
  return (
    scene.asset_method === "screen_demo" ||
    scene.visual_method === "screen_recording" ||
    scene.purpose === "demo" ||
    scene.role === "demo"
  );
}

function resolveStaticReferenceImageUrl(input: {
  productScreenshotUrl?: string | null;
  scenePurpose: SceneContract["purpose"];
  visualMethod?: string | null;
}): string | undefined {
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
  willHaveAssCaptions: boolean,
  slideStyle: "default" | "kinetic" | "metric" | "motion" = "default"
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
      { aspectRatio: ctx.aspectRatio, brandColor: ctx.brandColor, slideStyle }
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

function slideStyleForScene(
  ctx: SceneRenderContext,
  scene: SceneRow,
  override?: "default" | "kinetic" | "metric" | "motion"
): "default" | "kinetic" | "metric" | "motion" {
  if (override) return override;
  const purpose = (scene.purpose as SceneContract["purpose"] | null) ?? roleToPurpose(scene.role);
  const plan = buildSceneRenderPlan({
    creativeFormat: ctx.creativeFormat,
    renderStyle: ctx.renderStyle,
    qualityTier: ctx.qualityTier,
    falConfigured: isFalConfigured(),
  });
  const entry = plan.find((e) => e.purpose === purpose);
  return entry ? sceneRenderMethodToSlideStyle(entry.method) : "default";
}

async function renderSlideFallback(
  ctx: SceneRenderContext,
  scene: SceneRow,
  duration: number,
  scenePath: string,
  willHaveAssCaptions: boolean,
  reason: string
): Promise<SceneRenderOutput> {
  const slideStyle =
    ctx.fallbackOnBadAiScene === "replace_with_motion_slide"
      ? "motion"
      : slideStyleForScene(ctx, scene);
  const sceneFile = await renderSlideScene(
    ctx,
    scene,
    duration,
    scenePath,
    willHaveAssCaptions,
    slideStyle
  );
  await ctx.supabase
    .from("storyboard_scenes")
    .update({
      status: "ready",
      asset_method: "slide",
      visual_method: "slide",
      metadata: {
        visuals_ready: true,
        fallback_reason: reason,
        slide_style: slideStyle,
        visual_pipeline: "slide",
      } as never,
    } as never)
    .eq("id", scene.id);
  return {
    sceneFile,
    partialFailure: `Scene ${scene.scene_index} AI fallback → ${slideStyle} slide: ${reason}`,
    sceneMetadata: { visuals_ready: true, visual_pipeline: "slide", slide_style: slideStyle },
  };
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

  const willHaveAssCaptions = audioModeUsesVoiceover(ctx.audioMode);

  // Legacy storyboards may still have removed screen-demo beats — render as
  // mechanism (screenshot/slide), never as problem AI b-roll (wrong scene + slow Fal).
  if (isLegacyDemoScene(scene)) {
    const slideStyle = slideStyleForScene(ctx, { ...scene, purpose: "mechanism" });
    const sceneFile = await renderSlideScene(
      ctx,
      scene,
      duration,
      scenePath,
      willHaveAssCaptions,
      slideStyle
    );
    await ctx.supabase
      .from("storyboard_scenes")
      .update({
        status: "ready",
        asset_method: "slide",
        visual_method: "slide",
        metadata: {
          visuals_ready: true,
          legacy_demo_migrated: "mechanism_slide",
          slide_style: slideStyle,
          visual_pipeline: "slide",
        } as never,
      } as never)
      .eq("id", scene.id);
    return {
      sceneFile,
      sceneMetadata: {
        visuals_ready: true,
        legacy_demo_migrated: "mechanism_slide",
        visual_pipeline: "slide",
      },
    };
  }

  const useBroll =
    scene.asset_method === "fal_clip" || scene.visual_method === "ai_broll";

  if (useBroll && ctx.falCount.value >= ctx.falScenesCap) {
    return renderSlideFallback(
      ctx,
      scene,
      duration,
      scenePath,
      willHaveAssCaptions,
      `fal cap (${ctx.falScenesCap}) reached`
    );
  }

  if (useBroll && ctx.falCount.value < ctx.falScenesCap) {
    ctx.falCount.value++;
    const pipeline = ctx.visualPipeline === "image_to_video" ? "image_to_video" : "t2v";

    try {
      const falResult = await tryFalBroll(ctx, scene, duration, scenePath, pipeline);
      if (falResult) {
        return { sceneFile: falResult, sceneMetadata: { visuals_ready: true } };
      }
      if (ctx.fallbackOnBadAiScene === "fail_render") {
        throw new Error(`Scene ${scene.scene_index}: AI b-roll generation failed`);
      }
    } catch (brollErr) {
      const reason = brollErr instanceof Error ? brollErr.message : String(brollErr);
      if (ctx.fallbackOnBadAiScene === "fail_render") {
        throw brollErr instanceof Error ? brollErr : new Error(reason);
      }

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
          return renderSlideFallback(
            ctx,
            scene,
            duration,
            scenePath,
            willHaveAssCaptions,
            t2vReason
          );
        }
      }
      return renderSlideFallback(ctx, scene, duration, scenePath, willHaveAssCaptions, reason);
    }
  }

  const slideStyle = slideStyleForScene(ctx, scene);
  const sceneFile = await renderSlideScene(
    ctx,
    scene,
    duration,
    scenePath,
    willHaveAssCaptions,
    slideStyle
  );
  await ctx.supabase
    .from("storyboard_scenes")
    .update({
      status: "ready",
      asset_id: null,
      metadata: { visuals_ready: true, visual_pipeline: "slide", slide_style: slideStyle } as never,
    } as never)
    .eq("id", scene.id);

  return { sceneFile, sceneMetadata: { visuals_ready: true, visual_pipeline: "slide" } };
}
