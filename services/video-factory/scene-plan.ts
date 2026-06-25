import type { ProductionMode } from "./production-modes";
import { PRODUCTION_MODE_SPECS } from "./production-modes";
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
  script: VideoScript;
  hook: string;
  cta: string;
  targetLengthSeconds: number;
  preferAiBroll?: boolean;
}

/**
 * Deterministic scene plan templates per production mode.
 * AI storyboard can refine, but every video starts from a inspectable plan.
 */
export function buildScenePlan(input: BuildScenePlanInput): ScenePlan {
  const spec = PRODUCTION_MODE_SPECS[input.productionMode];
  const scenes = templateForMode(input);
  const total = scenes.reduce((s, sc) => s + sc.duration_seconds, 0);

  return ScenePlanSchema.parse({
    production_mode: input.productionMode,
    aspect_ratio: "9:16",
    total_duration_seconds: Math.round(total),
    scenes,
  });
}

function templateForMode(input: BuildScenePlanInput): SceneContract[] {
  switch (input.productionMode) {
    case "fast_slides":
      return fastSlidesTemplate(input);
    case "demo_short":
      return demoShortTemplate(input);
    case "ai_broll_short":
      return aiBrollTemplate(input);
    default:
      return fastSlidesTemplate(input);
  }
}

function fastSlidesTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const body = input.script.body_lines.slice(0, 4);
  const cta = input.script.cta_line || input.cta;

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

  // Ensure 4–7 scenes
  while (beats.length < 4 && body.length) {
    beats.splice(beats.length - 1, 0, {
      purpose: "proof",
      text: body[0]!,
      vo: body[0]!,
      dur: 2.5,
    });
  }

  return beats.slice(0, 7).map((b, order) => ({
    order,
    scene_type: "fast_slides",
    purpose: b.purpose,
    visual_method: "slide",
    voiceover_text: b.vo,
    subtitle_text: b.vo,
    overlay_text: b.overlay ?? "",
    visual_prompt: b.text,
    duration_seconds: b.dur,
    status: "planned" as const,
  }));
}

function demoShortTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const cta = input.script.cta_line || input.cta;
  const problem = input.script.body_lines[0] ?? "The manual workflow is too slow.";
  const mechanism = input.script.body_lines[1] ?? "Here is the faster way.";

  return [
    scene(0, "hook", "slide", hook, 2),
    scene(1, "problem", "slide", problem, 3),
    scene(2, "demo", "screen_recording", mechanism, 8, "Screen recording placeholder — upload or capture product UI."),
    scene(3, "proof", "screenshot", input.script.body_lines[2] ?? "Result in seconds.", 4),
    scene(4, "cta", "slide", cta, 3),
  ];
}

function aiBrollTemplate(input: BuildScenePlanInput): SceneContract[] {
  const hook = input.script.hook_line || input.hook;
  const cta = input.script.cta_line || input.cta;
  const body = input.script.body_lines.slice(0, 2);

  return [
    scene(0, "hook", "slide", hook, 2.5),
    scene(1, "problem", input.preferAiBroll ? "ai_broll" : "slide", body[0] ?? hook, 4, "Cinematic b-roll illustrating the pain."),
    scene(2, "mechanism", input.preferAiBroll ? "ai_broll" : "slide", body[1] ?? "The fix is simpler than you think.", 5, "Product-adjacent visual metaphor."),
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
  visualPrompt = ""
): SceneContract {
  return {
    order,
    scene_type: "scene",
    purpose,
    visual_method: visual,
    voiceover_text: text,
    subtitle_text: text,
    overlay_text: purpose === "hook" ? text.split(" ").slice(0, 5).join(" ") : "",
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
