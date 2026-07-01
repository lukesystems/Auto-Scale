import { describe, expect, it } from "vitest";
import { buildScenePlan } from "@/services/video-factory/scene-plan";
import { ScenePlanSchema } from "@/services/video-factory/scene-contract";

const SCRIPT = {
  hook_line: "Everyone says cold outreach is dead",
  body_lines: [
    "Myth: You need a huge team to run growth experiments",
    "Reality: One URL seeds a full video run",
    "Founders ship three variants before lunch",
    "Spreadsheets and manual exports",
    "One URL → experiments in a run",
  ],
  cta_line: "Try AutoScale free",
  voiceover_full: "hook body cta",
  on_screen_text: [],
  estimated_duration_seconds: 24,
};

describe("scene plan Phase 2 formats", () => {
  it("objection template: myth → reality → proof → cta", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      productionFormat: "objection",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 24,
    });
    ScenePlanSchema.parse(plan);
    expect(plan.scenes[1]?.overlay_text).toContain("MYTH|");
    expect(plan.scenes[2]?.overlay_text).toContain("REALITY|");
    expect(plan.scenes.some((s) => s.purpose === "proof")).toBe(true);
    expect(plan.scenes.at(-1)?.purpose).toBe("cta");
  });

  it("comparison template uses THEM vs US split overlays", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      productionFormat: "comparison",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
    });
    expect(plan.scenes.some((s) => s.overlay_text?.startsWith("THEM|"))).toBe(true);
    expect(plan.scenes.some((s) => s.overlay_text?.startsWith("US|"))).toBe(true);
  });

  it("legacy demo_short mode routes to ai b-roll template", () => {
    const plan = buildScenePlan({
      productionMode: "demo_short",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 28,
      preferAiBroll: true,
      falConfigured: true,
    });
    expect(plan.scenes.some((s) => s.visual_method === "ai_broll")).toBe(true);
    expect(plan.scenes.find((s) => s.purpose === "demo")).toBeUndefined();
  });
});
