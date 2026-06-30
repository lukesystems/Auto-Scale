import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import {
  resolveProductionModeFromFormat,
  resolveProductionOptions,
  audioModeUsesMusic,
  audioModeUsesVoiceover,
  PRODUCTION_FORMAT_SPECS,
} from "@/services/video-factory/production-options";
import {
  backgroundMusicVolumeForMode,
  shouldDuckMusicUnderVoice,
} from "@/services/video-factory/audio-mix";
import { buildScenePlan } from "@/services/video-factory/scene-plan";

const SCRIPT = {
  hook_line: "Your SaaS onboarding is bleeding users",
  body_lines: [
    "Founders waste hours on manual setup",
    "AutoScale turns your URL into video experiments",
    "Ship trend-backed shorts in one run",
  ],
  cta_line: "Try AutoScale free",
  voiceover_full: "hook body cta",
  on_screen_text: [],
  estimated_duration_seconds: 22,
};

describe("production format resolution", () => {
  it("maps user formats to internal production modes", () => {
    expect(resolveProductionModeFromFormat("slide")).toBe("fast_slides");
    expect(resolveProductionModeFromFormat("pain_led")).toBe("fast_slides");
    expect(resolveProductionModeFromFormat("ai_broll_short")).toBe("ai_broll_short");
    expect(resolveProductionModeFromFormat("objection")).toBe("fast_slides");
    expect(resolveProductionModeFromFormat("comparison")).toBe("fast_slides");
    expect(resolveProductionModeFromFormat("demo_short")).toBe("demo_short");
  });

  it("marks all six formats as implemented", () => {
    expect(PRODUCTION_FORMAT_SPECS.slide.implemented).toBe(true);
    expect(PRODUCTION_FORMAT_SPECS.pain_led.implemented).toBe(true);
    expect(PRODUCTION_FORMAT_SPECS.ai_broll_short.implemented).toBe(true);
    expect(PRODUCTION_FORMAT_SPECS.objection.implemented).toBe(true);
    expect(PRODUCTION_FORMAT_SPECS.comparison.implemented).toBe(true);
    expect(PRODUCTION_FORMAT_SPECS.demo_short.implemented).toBe(true);
  });

  it("resolves defaults from project settings", () => {
    const resolved = resolveProductionOptions({
      projectDefaults: { production_format: "pain_led", audio_mode: "music_only" },
    });
    expect(resolved.productionFormat).toBe("pain_led");
    expect(resolved.audioMode).toBe("music_only");
  });

  it("defaults fal_render_mode to cinematic when fal is configured", () => {
    const resolved = resolveProductionOptions({ falConfigured: true });
    expect(resolved.falRenderMode).toBe("cinematic");
  });

  it("defaults fal_render_mode to fast when fal is not configured", () => {
    const resolved = resolveProductionOptions({ falConfigured: false });
    expect(resolved.falRenderMode).toBe("fast");
  });
});

describe("audio mode routing", () => {
  it("identifies voice and music usage per mode", () => {
    expect(audioModeUsesVoiceover("voiceover")).toBe(true);
    expect(audioModeUsesVoiceover("voiceover_bgm")).toBe(true);
    expect(audioModeUsesVoiceover("music_only")).toBe(false);

    expect(audioModeUsesMusic("music_only")).toBe(true);
    expect(audioModeUsesMusic("voiceover_bgm")).toBe(true);
    expect(audioModeUsesMusic("voiceover")).toBe(false);
  });

  it("sets mix volumes and ducking flags", () => {
    expect(backgroundMusicVolumeForMode("music_only")).toBeGreaterThan(
      backgroundMusicVolumeForMode("voiceover_bgm")
    );
    expect(shouldDuckMusicUnderVoice("voiceover_bgm")).toBe(true);
    expect(shouldDuckMusicUnderVoice("music_only")).toBe(false);
  });
});

describe("scene plan per production format", () => {
  beforeEach(() => {
    vi.stubEnv("FAL_KEY", "test-fal-key");
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("slide format uses only slide visuals", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      productionFormat: "slide",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
    });
    expect(plan.scenes.every((s) => s.visual_method === "slide")).toBe(true);
  });

  it("pain_led uses ai_broll for middle scenes when fal is configured", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      productionFormat: "pain_led",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
      preferAiBroll: true,
    });
    expect(plan.scenes[0]?.visual_method).toBe("slide");
    expect(plan.scenes.some((s) => s.visual_method === "ai_broll")).toBe(true);
    expect(plan.scenes.at(-1)?.visual_method).toBe("slide");
    expect(plan.scenes.at(-1)?.purpose).toBe("cta");
  });

  it("ai_broll_short uses slide bookends and b-roll middle", () => {
    const plan = buildScenePlan({
      productionMode: "ai_broll_short",
      productionFormat: "ai_broll_short",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 24,
      preferAiBroll: true,
    });
    expect(plan.scenes[0]?.visual_method).toBe("slide");
    expect(plan.scenes.at(-1)?.visual_method).toBe("slide");
    expect(plan.scenes.some((s) => s.visual_method === "ai_broll")).toBe(true);
  });

  it("objection template uses myth/reality overlays", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      productionFormat: "objection",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
    });
    expect(plan.scenes.some((s) => s.overlay_text?.startsWith("MYTH|"))).toBe(true);
    expect(plan.scenes.some((s) => s.overlay_text?.startsWith("REALITY|"))).toBe(true);
  });

  it("comparison template uses them/us overlays", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      productionFormat: "comparison",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 24,
    });
    expect(plan.scenes.some((s) => s.overlay_text?.startsWith("THEM|"))).toBe(true);
    expect(plan.scenes.some((s) => s.overlay_text?.startsWith("US|"))).toBe(true);
  });
});
