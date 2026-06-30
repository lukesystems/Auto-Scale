import { describe, expect, it } from "vitest";
import { buildBrollVisualPrompt, buildSceneFramePrompt } from "@/services/video-factory/broll-prompt";
import {
  resolveVisualPipeline,
  resolveProductionOptions,
} from "@/services/video-factory/production-options";

const PROMPT_INPUT = {
  productSummary: "AI growth tool for SaaS founders",
  scenePurpose: "hook",
  hook: "Your onboarding is broken",
  audience: "technical founders",
  tone: "professional",
  durationSeconds: 5,
  aspectRatio: "9:16",
};

describe("visual pipeline resolution", () => {
  it("defaults to t2v for backward compatibility", () => {
    expect(
      resolveVisualPipeline({
        productionFormat: "pain_led",
        falRenderMode: "cinematic",
        falConfigured: true,
      })
    ).toBe("t2v");
  });

  it("auto-selects image_to_video for ai_broll_short cinematic with fal", () => {
    expect(
      resolveVisualPipeline({
        productionFormat: "ai_broll_short",
        falRenderMode: "cinematic",
        falConfigured: true,
      })
    ).toBe("image_to_video");
  });

  it("respects explicit visual_pipeline override", () => {
    const resolved = resolveProductionOptions({
      productionFormat: "slide",
      visualPipeline: "image_to_video",
      falConfigured: true,
    });
    expect(resolved.visualPipeline).toBe("image_to_video");
  });
});

describe("broll prompt builders", () => {
  it("buildBrollVisualPrompt includes motion and camera direction", () => {
    const prompt = buildBrollVisualPrompt(PROMPT_INPUT);
    expect(prompt.toLowerCase()).toContain("camera");
    expect(prompt.toLowerCase()).toContain("motion");
  });

  it("buildSceneFramePrompt is static with no motion verbs", () => {
    const prompt = buildSceneFramePrompt(PROMPT_INPUT);
    expect(prompt.toLowerCase()).toContain("static");
    expect(prompt.toLowerCase()).not.toContain("motion:");
    expect(prompt.toLowerCase()).not.toContain("camera:");
  });
});
