import type { ProductionFormat } from "./production-options";
import type { CreativeFormat, QualityTier, RenderStyle } from "./scene-render-plan";
import {
  buildSceneRenderPlan,
  sceneRenderMethodToVisualMethod,
  shouldUseAiBrollForScene,
} from "./scene-render-plan";
import type { FalRenderMode } from "./production-options";
import type { ProductionMode } from "./production-modes";
import { normalizeProductionMode } from "./production-modes";
import {
  type SceneContract,
  type ScenePlan,
  ScenePlanSchema,
  purposeToRole,
  visualMethodToAssetMethod,
} from "./scene-contract";
import type { VideoScript } from "@/services/growth-run/schema";
import type { Database } from "@/lib/supabase/types";

export interface BuildScenePlanInput {
  productionMode: ProductionMode;
  /** User-facing format — overrides template routing when set. */
  productionFormat?: ProductionFormat;
  creativeFormat?: CreativeFormat;
  renderStyle?: RenderStyle;
  qualityTier?: QualityTier;
  falRenderMode?: FalRenderMode;
  script: VideoScript;
  hook: string;
  cta: string;
  targetLengthSeconds: number;
  preferAiBroll?: boolean;
  /** Set on server from isFalConfigured(); defaults false for safe client imports. */
  falConfigured?: boolean;
}

/**
 * Deterministic scene plan templates per production mode.
 * AI storyboard can refine, but every video starts from a inspectable plan.
 */
export function buildScenePlan(input: BuildScenePlanInput): ScenePlan {
  const scenes = templateForMode(input);
  const total = scenes.reduce((s, sc) => s + sc.duration_seconds, 0);

  return ScenePlanSchema.parse({
    production_mode: input.productionMode,
    aspect_ratio: "9:16",
    total_duration_seconds: Math.round(total),
    scenes,
  });
}

function resolveCreativeFormat(input: BuildScenePlanInput): CreativeFormat {
  if (input.creativeFormat) return input.creativeFormat;
  if (input.productionFormat === "objection") return "objection_handler";
  if (input.productionFormat === "comparison") return "comparison";
  return "pain_led";
}

function resolveRenderStyle(input: BuildScenePlanInput): RenderStyle {
  if (input.renderStyle) return input.renderStyle;
  if (input.productionFormat === "slide") return "slides_only";
  if (input.productionFormat === "ai_broll_short") return "full_ai_video";
  if (input.preferAiBroll === false) return "slides_only";
  if (input.preferAiBroll || input.productionFormat === "pain_led") return "hybrid_quality";
  return "slides_only";
}

function resolveQualityTier(input: BuildScenePlanInput): QualityTier {
  if (input.qualityTier) return input.qualityTier;
  if (input.falRenderMode === "fast" || !input.falConfigured) return "draft";
  return "cinematic";
}

function templateForMode(input: BuildScenePlanInput): SceneContract[] {
  const creativeFormat = resolveCreativeFormat(input);
  const renderStyle = resolveRenderStyle(input);
  const qualityTier = resolveQualityTier(input);
  const falConfigured = input.falConfigured ?? false;

  const renderPlan = buildSceneRenderPlan({
    creativeFormat,
    renderStyle,
    qualityTier,
    falConfigured,
  });

  if (
    input.productionFormat === "objection" ||
    creativeFormat === "objection_handler"
  ) {
    return applyRenderPlan(objectionTemplate(input), renderPlan, input);
  }
  if (input.productionFormat === "comparison" || creativeFormat === "comparison") {
    return applyRenderPlan(comparisonTemplate(input), renderPlan, input);
  }
  if (renderStyle === "slides_only" && !input.preferAiBroll) {
    return applyRenderPlan(fastSlidesTemplate({ ...input, preferAiBroll: false }), renderPlan, input);
  }
  if (renderStyle === "full_ai_video") {
    return applyRenderPlan(aiBrollTemplate({ ...input, preferAiBroll: true }), renderPlan, input);
  }
  if (renderStyle === "hybrid_quality" || input.productionFormat === "pain_led") {
    return applyRenderPlan(painLedTemplate(input), renderPlan, input);
  }

  switch (normalizeProductionMode(input.productionMode)) {
    case "fast_slides":
      return applyRenderPlan(
        input.preferAiBroll ? painLedTemplate(input) : fastSlidesTemplate(input),
        renderPlan,
        input
      );
    case "ai_broll_short":
      return applyRenderPlan(aiBrollTemplate(input), renderPlan, input);
    case "reference_remix":
      return applyRenderPlan(
        input.preferAiBroll ? aiBrollTemplate(input) : fastSlidesTemplate(input),
        renderPlan,
        input
      );
    default:
      return applyRenderPlan(fastSlidesTemplate(input), renderPlan, input);
  }
}

/** Apply explicit render plan methods onto template scenes by purpose. */
function applyRenderPlan(
  scenes: SceneContract[],
  renderPlan: ReturnType<typeof buildSceneRenderPlan>,
  input: BuildScenePlanInput
): SceneContract[] {
  const renderStyle = resolveRenderStyle(input);
  const qualityTier = resolveQualityTier(input);
  const falConfigured = input.falConfigured ?? false;
  const planByPurpose = new Map(renderPlan.map((e) => [e.purpose, e]));

  return scenes.map((scene, order) => {
    const entry = planByPurpose.get(scene.purpose);
    let visualMethod = scene.visual_method;
    if (entry) {
      visualMethod = sceneRenderMethodToVisualMethod(entry.method);
      if (
        visualMethod === "ai_broll" &&
        !shouldUseAiBrollForScene(scene.purpose, renderStyle, qualityTier, falConfigured)
      ) {
        visualMethod = entry.method === "screenshot" ? "screenshot" : "slide";
      }
    }
    return {
      ...scene,
      order,
      visual_method: visualMethod,
      visual_prompt:
        visualMethod === "ai_broll"
          ? `Cinematic b-roll for "${scene.purpose}" scene. Context: ${scene.voiceover_text.slice(0, 120)}`
          : scene.visual_prompt,
    };
  });
}

function visualMethodForPurpose(
  purpose: SceneContract["purpose"],
  preferAiBroll?: boolean,
  renderStyle?: RenderStyle,
  qualityTier?: QualityTier,
  falConfigured?: boolean
): SceneContract["visual_method"] {
  if (renderStyle && qualityTier) {
    if (shouldUseAiBrollForScene(purpose, renderStyle, qualityTier, falConfigured)) {
      return "ai_broll";
    }
    if (purpose === "mechanism" || purpose === "proof") {
      return renderStyle === "product_demo" ? "screenshot" : "slide";
    }
    return "slide";
  }
  if (
    preferAiBroll &&
    (purpose === "problem" || purpose === "mechanism" || purpose === "proof")
  ) {
    return "ai_broll";
  }
  return "slide";
}

function fastSlidesTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const body = input.script.body_lines.slice(0, 4);
  const cta = input.script.cta_line || input.cta;
  const renderStyle = resolveRenderStyle(input);
  const qualityTier = resolveQualityTier(input);

  const beats: Array<{
    purpose: SceneContract["purpose"];
    text: string;
    vo: string;
    dur: number;
    overlay?: string;
  }> = [
    { purpose: "hook", text: hook, vo: hook, dur: 2.5, overlay: hook.split(" ").slice(0, 6).join(" ") },
    ...body.map((line, i) => ({
      purpose: (i === 0 ? "problem" : i === body.length - 1 ? "mechanism" : "proof") as SceneContract["purpose"],
      text: line,
      vo: line,
      dur: 3,
    })),
    { purpose: "cta", text: cta, vo: cta, dur: 3, overlay: "Try it →" },
  ];

  while (beats.length < 4 && body.length) {
    beats.splice(beats.length - 1, 0, {
      purpose: "proof",
      text: body[0]!,
      vo: body[0]!,
      dur: 2.5,
    });
  }

  return beats.slice(0, 7).map((b, order) => {
    const method = visualMethodForPurpose(
      b.purpose,
      input.preferAiBroll,
      renderStyle,
      qualityTier,
      input.falConfigured
    );
    return {
      order,
      scene_type: "fast_slides",
      purpose: b.purpose,
      visual_method: method,
      voiceover_text: b.vo,
      subtitle_text: b.vo,
      overlay_text: b.overlay ?? "",
      visual_prompt: method === "ai_broll"
        ? `Cinematic b-roll for "${b.purpose}" scene. Context: ${b.text.slice(0, 120)}`
        : b.text,
      duration_seconds: b.dur,
      status: "planned" as const,
    };
  });
}

function objectionTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const cta = input.script.cta_line || input.cta;
  const myth = input.script.body_lines[0] ?? "This won't work for our team.";
  const reality = input.script.body_lines[1] ?? "Here's what actually changes.";
  const proof = input.script.body_lines[2] ?? "Founders ship in one afternoon.";

  return [
    scene(0, "hook", "slide", hook, 2.5, "", hook.split(" ").slice(0, 6).join(" ")),
    scene(1, "problem", "slide", myth, 3.5, "", `MYTH|${myth}`),
    scene(2, "mechanism", "slide", reality, 4, "", `REALITY|${reality}`),
    scene(3, "proof", "slide", proof, 3.5),
    scene(4, "cta", "slide", cta, 3, "", "Try it →"),
  ];
}

function comparisonTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const cta = input.script.cta_line || input.cta;
  const them = input.script.body_lines[0] ?? "Spreadsheets and manual exports.";
  const us = input.script.body_lines[1] ?? "One URL → experiments in a run.";
  const proof = input.script.body_lines[2] ?? "Technical founders save hours weekly.";

  return [
    scene(0, "hook", "slide", hook, 2.5),
    scene(1, "problem", "slide", them, 3.5, "", `THEM|${them}`),
    scene(2, "mechanism", "slide", us, 4, "", `US|${us}`),
    scene(3, "proof", "slide", proof, 3),
    scene(4, "cta", "slide", cta, 3, "", "Try it →"),
  ];
}

function painLedTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const cta = input.script.cta_line || input.cta;
  const body = input.script.body_lines.slice(0, 3);
  const renderStyle = resolveRenderStyle(input);
  const qualityTier = resolveQualityTier(input);
  const useBroll = shouldUseAiBrollForScene("problem", renderStyle, qualityTier, input.falConfigured);

  const middlePurposes: Array<SceneContract["purpose"]> = ["problem", "mechanism", "proof"];
  const beats: SceneContract[] = [
    scene(0, "hook", "slide", hook, 2.5),
    ...body.map((line, i) => {
      const purpose = middlePurposes[i] ?? "proof";
      const method = visualMethodForPurpose(
        purpose,
        useBroll || input.preferAiBroll,
        renderStyle,
        qualityTier,
        input.falConfigured
      );
      return scene(
        i + 1,
        purpose,
        method,
        line,
        3.5,
        method === "ai_broll"
          ? `Cinematic b-roll for "${purpose}" scene. Context: ${line.slice(0, 120)}`
          : ""
      );
    }),
    scene(body.length + 1, "cta", "slide", cta, 3, "", "Try it →"),
  ];

  while (beats.length < 4) {
    beats.splice(beats.length - 1, 0, scene(beats.length - 1, "proof", "slide", body[0] ?? hook, 2.5));
  }

  return beats.slice(0, 7).map((b, order) => ({ ...b, order }));
}

function aiBrollTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const cta = input.script.cta_line || input.cta;
  const body = input.script.body_lines.slice(0, 2);
  const renderStyle = resolveRenderStyle(input);
  const qualityTier = resolveQualityTier(input);
  const useProblemBroll = shouldUseAiBrollForScene("problem", renderStyle, qualityTier, input.falConfigured);
  const useMechanismBroll = shouldUseAiBrollForScene("mechanism", renderStyle, qualityTier, input.falConfigured);

  return [
    scene(0, "hook", "slide", hook, 2.5),
    scene(
      1,
      "problem",
      useProblemBroll || input.preferAiBroll ? "ai_broll" : "slide",
      body[0] ?? hook,
      4,
      `Cinematic b-roll for "problem" scene. Visual metaphor for frustration. Context: ${(body[0] ?? hook).slice(0, 120)}`
    ),
    scene(
      2,
      "mechanism",
      useMechanismBroll || input.preferAiBroll ? "ai_broll" : "slide",
      body[1] ?? "The fix is simpler than you think.",
      5,
      `Cinematic b-roll for "mechanism" scene. Clean transformation visual. Context: ${(body[1] ?? "solution workflow").slice(0, 120)}`
    ),
    scene(3, "proof", "slide", body[1] ?? "Works for technical founders.", 3),
    scene(4, "cta", "slide", cta, 3),
  ];
}

function scene(
  order: number,
  purpose: SceneContract["purpose"],
  visual: SceneContract["visual_method"],
  text: string,
  dur: number,
  visualPrompt = "",
  overlayText?: string
): SceneContract {
  return {
    order,
    scene_type: "scene",
    purpose,
    visual_method: visual,
    voiceover_text: text,
    subtitle_text: text,
    overlay_text:
      overlayText ??
      (purpose === "hook" ? text.split(" ").slice(0, 5).join(" ") : purpose === "cta" ? "Try it →" : ""),
    visual_prompt: visualPrompt || text,
    duration_seconds: dur,
    status: "planned",
  };
}

/** Convert scene plan rows for DB insert alongside AI storyboard. */
export function scenePlanToStoryboardRows(
  plan: ScenePlan,
  storyboardId: string
): Array<Database["public"]["Tables"]["storyboard_scenes"]["Insert"]> {
  return plan.scenes.map((s) => ({
    storyboard_id: storyboardId,
    scene_index: s.order,
    role: purposeToRole(s.purpose),
    purpose: s.purpose,
    scene_type: s.scene_type,
    visual_method: s.visual_method,
    duration_seconds: s.duration_seconds,
    visual_intent: s.visual_prompt || s.voiceover_text,
    on_screen_text: s.overlay_text || s.visual_prompt,
    voiceover_line: s.voiceover_text,
    subtitle_text: s.subtitle_text,
    overlay_text: s.overlay_text,
    asset_method: visualMethodToAssetMethod(s.visual_method),
    asset_prompt: s.visual_prompt || null,
    status: s.status,
  }));
}

export { purposeToRole, visualMethodToAssetMethod };
