import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadProjectGrowthSettings } from "@/services/project-growth-settings/load";
import { GrowthRunOptionsSchema } from "@/services/growth-run/schema";
import type { GrowthRunOptions } from "@/services/growth-run/schema";
import { isFalConfigured } from "@/services/media/fal-config";
import {
  coerceProductionFormat,
  resolveProductionOptions,
  coerceFallbackOnBadAiScene,
  DEFAULT_PRODUCTION_QUALITY_OPTIONS,
  type AudioMode,
  type CreativeFormat,
  type FalModelTier,
  type FalRenderMode,
  type ProductionFormat,
  type QualityTier,
  type RenderStyle,
  type VideoOutputMode,
  type VisualPipeline,
} from "./production-options";
import type { FallbackOnBadAiScene } from "./scene-render-plan";

export interface ResolvedRunProductionOptions {
  productionFormat: ProductionFormat;
  videoOutputMode: VideoOutputMode;
  creativeFormat: CreativeFormat;
  renderStyle: RenderStyle;
  qualityTier: QualityTier;
  audioMode: AudioMode;
  falRenderMode: FalRenderMode;
  falModelTier: FalModelTier;
  visualPipeline: VisualPipeline;
  maxFalScenes: number;
  fallbackOnBadAiScene: FallbackOnBadAiScene;
  requireSceneReview: boolean;
}

export interface RunProductionContext {
  storedRunOptions: Partial<GrowthRunOptions>;
  resolved: ResolvedRunProductionOptions;
}

/** Single source of truth: load run options from DB and resolve production settings. */
export async function loadRunProductionContext(
  growthRunId: string,
  projectId?: string,
  client?: SupabaseClient<Database>
): Promise<RunProductionContext> {
  const supabase = client ?? createSupabaseServerClient();
  const { data } = await supabase
    .from("growth_runs")
    .select("options, project_id")
    .eq("id", growthRunId)
    .maybeSingle();

  const runOptionsRaw =
    data?.options && typeof data.options === "object" && !Array.isArray(data.options)
      ? data.options
      : {};
  const storedRunOptions = GrowthRunOptionsSchema.partial().parse(runOptionsRaw);

  const effectiveProjectId = projectId ?? data?.project_id;
  const projectDefaults = effectiveProjectId
    ? await loadProjectGrowthSettings(effectiveProjectId)
    : null;

  const resolved = resolveProductionOptions({
    productionFormat: coerceProductionFormat(
      typeof storedRunOptions.production_format === "string"
        ? storedRunOptions.production_format
        : null
    ),
    videoOutputMode: storedRunOptions.video_output_mode ?? null,
    creativeFormat: storedRunOptions.creative_format ?? null,
    renderStyle: storedRunOptions.render_style ?? null,
    qualityTier: storedRunOptions.quality_tier ?? null,
    audioMode: storedRunOptions.audio_mode ?? null,
    falRenderMode: storedRunOptions.fal_render_mode ?? null,
    falModelTier: storedRunOptions.fal_model_tier ?? null,
    visualPipeline: storedRunOptions.visual_pipeline ?? null,
    maxFalScenes:
      storedRunOptions.max_ai_video_scenes ?? storedRunOptions.max_fal_scenes ?? null,
    falConfigured: isFalConfigured(),
    projectDefaults: projectDefaults
      ? {
          production_format: projectDefaults.production_format,
          video_output_mode: projectDefaults.video_output_mode,
          creative_format: projectDefaults.creative_format,
          render_style: projectDefaults.render_style,
          quality_tier: projectDefaults.quality_tier,
          audio_mode: projectDefaults.audio_mode,
          max_fal_scenes: projectDefaults.max_fal_scenes,
        }
      : undefined,
  });

  return {
    storedRunOptions,
    resolved: {
      ...resolved,
      fallbackOnBadAiScene: coerceFallbackOnBadAiScene(
        storedRunOptions.fallback_on_bad_ai_scene ?? null
      ),
      requireSceneReview:
        storedRunOptions.require_scene_review ??
        DEFAULT_PRODUCTION_QUALITY_OPTIONS.requireSceneReview,
    },
  };
}
