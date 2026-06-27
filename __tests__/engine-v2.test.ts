import { describe, expect, it } from "vitest";
import { ProductionModeSchema, PRODUCTION_MODE_SPECS } from "@/services/video-factory/production-modes";
import { ScenePlanSchema, SceneContractSchema } from "@/services/video-factory/scene-contract";
import { buildScenePlan } from "@/services/video-factory/scene-plan";
import { checkSlideQuality } from "@/services/video-factory/slide-quality";
import { scoreVideo, isSchedulable, MIN_SCHEDULE_QUALITY_SCORE } from "@/services/video-quality/score";
import { getRenderProfile, RENDER_PROFILES } from "@/services/video-factory/render-profiles";
import { ReviseHookSchema } from "@/services/video-revision/schema";
import { formatVerifyReport, type VerifyGrowthRunReport } from "@/services/growth-run/verify";

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

describe("production mode schema", () => {
  it("accepts implemented modes", () => {
    expect(ProductionModeSchema.parse("fast_slides")).toBe("fast_slides");
    expect(PRODUCTION_MODE_SPECS.fast_slides.implemented).toBe(true);
    expect(PRODUCTION_MODE_SPECS.demo_short.implemented).toBe(false);
  });
});

describe("scene plan generation", () => {
  it("builds 4-7 fast_slides scenes with hook and cta", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
    });
    ScenePlanSchema.parse(plan);
    expect(plan.scenes.length).toBeGreaterThanOrEqual(4);
    expect(plan.scenes.length).toBeLessThanOrEqual(7);
    expect(plan.scenes[0]?.purpose).toBe("hook");
    expect(plan.scenes.some((s) => s.purpose === "cta")).toBe(true);
  });

  it("scaffolds demo_short with screen_recording scene", () => {
    const plan = buildScenePlan({
      productionMode: "demo_short",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 28,
    });
    expect(plan.scenes.some((s) => s.visual_method === "screen_recording")).toBe(true);
  });
});

describe("slide quality check", () => {
  it("passes a well-formed fast slide plan with mp4", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
    });
    const result = checkSlideQuality({
      scenes: plan.scenes,
      totalDurationSeconds: plan.total_duration_seconds,
      targetDurationSeconds: 22,
      mp4Url: "https://example.com/final.mp4",
    });
    expect(result.checks.hook_in_first_2s).toBe(true);
    expect(result.checks.cta_present).toBe(true);
    expect(result.checks.mp4_url_exists).toBe(true);
  });
});

describe("render profile selection", () => {
  it("maps platforms to 9:16 vertical profiles", () => {
    const tiktok = getRenderProfile("tiktok");
    expect(tiktok.width).toBe(1080);
    expect(tiktok.height).toBe(1920);
    expect(tiktok.aspectRatio).toBe("9:16");
    expect(RENDER_PROFILES.instagram_reels.maxDurationSeconds).toBeGreaterThan(0);
    expect(RENDER_PROFILES.youtube_shorts.captionSafeZone.bottom).toBeGreaterThan(0);
  });
});

describe("revision action contracts", () => {
  it("validates revise hook input", () => {
    const parsed = ReviseHookSchema.parse({
      projectId: "00000000-0000-4000-8000-000000000001",
      growthRunId: "00000000-0000-4000-8000-000000000002",
      videoId: "00000000-0000-4000-8000-000000000003",
      conceptId: "00000000-0000-4000-8000-000000000004",
      newHook: "Your onboarding is broken",
    });
    expect(parsed.newHook).toContain("onboarding");
  });
});

describe("video quality scoring", () => {
  it("blocks videos without mp4", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
    });
    const score = scoreVideo({
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      platform: "tiktok",
      productionMode: "fast_slides",
      scenes: plan.scenes,
      totalDurationSeconds: plan.total_duration_seconds,
      targetDurationSeconds: 22,
      mp4Url: null,
      trendConfidence: 0.2,
      missingEvidence: ["No source video"],
      slideQualityPassed: false,
    });
    expect(score.block_reason).toContain("MP4");
    expect(score.final_asset_exists).toBe(0);
    expect(isSchedulable(score)).toBe(false);
  });

  it("passes good videos above minimum score", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      script: SCRIPT,
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      targetLengthSeconds: 22,
    });
    const score = scoreVideo({
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      platform: "tiktok",
      productionMode: "fast_slides",
      scenes: plan.scenes,
      totalDurationSeconds: plan.total_duration_seconds,
      targetDurationSeconds: 22,
      mp4Url: "https://example.com/final.mp4",
      trendConfidence: 0.8,
      missingEvidence: [],
      slideQualityPassed: true,
    });
    expect(score.overall_score).toBeGreaterThanOrEqual(MIN_SCHEDULE_QUALITY_SCORE);
    expect(isSchedulable(score)).toBe(true);
    expect(score.pass_reasons.length).toBeGreaterThan(0);
  });
});

describe("trend receipt confidence downgrade", () => {
  function receiptConfidence(confidence: number, hasEvidence: boolean) {
    return hasEvidence ? confidence : Math.min(confidence, 0.35);
  }

  it("downgrades when evidence is missing", () => {
    expect(receiptConfidence(0.72, false)).toBe(0.35);
    expect(receiptConfidence(0.72, true)).toBe(0.72);
  });
});

describe("compound action decision", () => {
  function compoundAction(classification: string, nextAction: string) {
    if (classification === "winner") return "scale";
    if (classification === "kill" || nextAction === "kill") return "kill";
    if (["promising", "flat"].includes(classification)) return "iterate";
    return null;
  }

  it("maps classifications to compound actions", () => {
    expect(compoundAction("winner", "variant")).toBe("scale");
    expect(compoundAction("kill", "kill")).toBe("kill");
    expect(compoundAction("flat", "rewrite_hook")).toBe("iterate");
    expect(compoundAction("promising", "review")).toBe("iterate");
  });
});

describe("scheduling skip reasons", () => {
  const REASONS = [
    "no_connected_account",
    "video_not_ready",
    "no_final_mp4",
    "quality_score_too_low",
    "duplicate_hook_risk",
    "repeated_format_risk",
    "account_health_paused",
    "postiz_missing",
    "render_failed",
  ] as const;

  it("defines autopilot skip reason codes", () => {
    expect(REASONS).toContain("render_failed");
    expect(REASONS).toContain("quality_score_too_low");
    expect(REASONS).toContain("postiz_missing");
  });
});


describe("verify report formatter", () => {
  it("formats pass/fail with failed step", () => {
    const report: VerifyGrowthRunReport = {
      growthRunId: "run-1",
      projectId: "proj-1",
      passed: false,
      failedStep: 9,
      environment: {
        supabase: true,
        ffmpeg: true,
        postiz: false,
        publishing: false,
        publishingProvider: "postiz",
      },
      steps: [
        {
          step: 9,
          name: "video_ready_status",
          status: "fail",
          detail: "No ready videos",
          table: "videos",
        },
      ],
    };
    const text = formatVerifyReport(report);
    expect(text).toContain("FAIL");
    expect(text).toContain("step 9");
    expect(text).toContain("videos");
  });
});

describe("scene contract schema", () => {
  it("validates a scene row", () => {
    SceneContractSchema.parse({
      order: 0,
      scene_type: "fast_slides",
      purpose: "hook",
      visual_method: "slide",
      voiceover_text: "Stop losing users",
      subtitle_text: "Stop losing users",
      overlay_text: "Stop losing users",
      visual_prompt: "",
      duration_seconds: 2.5,
      status: "planned",
    });
  });
});
