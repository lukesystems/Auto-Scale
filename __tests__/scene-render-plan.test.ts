import { describe, expect, it } from "vitest";
import {
  buildSceneRenderPlan,
  legacyProductionFormatToCreative,
  maxFalScenesForTier,
  shouldUseAiBrollForScene,
} from "@/services/video-factory/scene-render-plan";

describe("scene render plan", () => {
  it("hybrid cinematic assigns kinetic hook, problem ai_broll, motion cta", () => {
    const plan = buildSceneRenderPlan({
      creativeFormat: "pain_led",
      renderStyle: "hybrid_quality",
      qualityTier: "cinematic",
      falConfigured: true,
    });
    expect(plan.find((e) => e.purpose === "hook")?.method).toBe("kinetic_slide");
    expect(plan.find((e) => e.purpose === "problem")?.method).toBe("ai_broll");
    expect(plan.find((e) => e.purpose === "mechanism")?.method).toBe("screenshot");
    expect(plan.find((e) => e.purpose === "proof")?.method).toBe("metric_slide");
    expect(plan.find((e) => e.purpose === "cta")?.method).toBe("motion_slide");
  });

  it("draft tier disables ai b-roll", () => {
    expect(
      shouldUseAiBrollForScene("problem", "hybrid_quality", "draft", true)
    ).toBe(false);
    expect(maxFalScenesForTier("draft", "hybrid_quality")).toBe(0);
  });

  it("maps legacy ai_broll_short to full ai cinematic preset", () => {
    const legacy = legacyProductionFormatToCreative("ai_broll_short");
    expect(legacy.videoOutputMode).toBe("full_ai_cinematic");
    expect(legacy.renderStyle).toBe("full_ai_video");
  });

  it("maps legacy slide format to kinetic text ad", () => {
    const legacy = legacyProductionFormatToCreative("slide");
    expect(legacy.videoOutputMode).toBe("kinetic_text_ad");
    expect(legacy.renderStyle).toBe("slides_only");
  });
});
