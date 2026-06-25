import { describe, expect, it } from "vitest";
import { resolveProjectCta } from "@/services/project-growth-settings/schema";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import { buildBrollVisualPrompt, brandSafetyCheckPrompt } from "@/services/video-factory/broll-prompt";
import { canEmbedInRenderedMp4 } from "@/services/audio/library";
import { parseMetricsCsv } from "@/services/platform-metrics/import";
import { scoreVideo, isSchedulable } from "@/services/video-quality/score";
import { buildScenePlan } from "@/services/video-factory/scene-plan";

describe("booking CTA support", () => {
  it("resolves Book a Demo with booking URL", () => {
    const cta = resolveProjectCta(
      {
        primary_cta_type: "book_demo",
        booking_url: "https://calendar.google.com/foo",
        default_cta_label: null,
        default_cta_url: null,
      },
      "https://product.com"
    );
    expect(cta.label).toBe("Book a Demo");
    expect(cta.intentType).toBe("demo_intent");
    expect(cta.url).toContain("calendar.google.com");
  });

  it("warns when book_demo without booking URL", () => {
    const cta = resolveProjectCta(
      {
        primary_cta_type: "book_demo",
        booking_url: null,
        default_cta_label: null,
        default_cta_url: null,
      },
      null
    );
    expect(cta.setupWarning).toBeTruthy();
    expect(cta.intentType).toBe("lead_intent");
  });
});

describe("ffmpeg health check", () => {
  it("returns structured health result", () => {
    const health = checkFfmpegHealth();
    expect(health).toHaveProperty("available");
    expect(health).toHaveProperty("message");
  });
});

describe("AI b-roll fallback", () => {
  it("builds brand-safe visual prompt", () => {
    const prompt = buildBrollVisualPrompt({
      productSummary: "AutoScale helps founders ship videos",
      scenePurpose: "hook",
      hook: "Stop wasting ad spend",
      audience: "SaaS founders",
      tone: "professional",
    });
    expect(prompt).toContain("brand-safe");
    expect(brandSafetyCheckPrompt("abstract motion for SaaS productivity").ok).toBe(true);
  });

  it("blocks unsafe prompts", () => {
    expect(brandSafetyCheckPrompt("fake testimonial from a celebrity").ok).toBe(false);
  });
});

describe("audio license guard", () => {
  it("allows royalty-free embed", () => {
    expect(canEmbedInRenderedMp4("royalty_free")).toBe(true);
    expect(canEmbedInRenderedMp4("reference_only")).toBe(false);
  });
});

describe("platform metrics CSV", () => {
  it("parses metric rows", () => {
    const rows = parseMetricsCsv(
      "video_id,views,likes\n00000000-0000-4000-8000-000000000001,100,10"
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.views).toBe(100);
  });
});

describe("silent voiceover quality penalty", () => {
  it("blocks schedulable silent voiceover", () => {
    const plan = buildScenePlan({
      productionMode: "fast_slides",
      script: {
        hook_line: "Your SaaS onboarding bleeds users every week",
        body_lines: ["Manual setup kills retention", "AutoScale fixes it"],
        cta_line: "Book a Demo",
        voiceover_full: "hook body cta",
        on_screen_text: [],
        estimated_duration_seconds: 22,
      },
      hook: "Your SaaS onboarding bleeds users every week",
      cta: "Book a Demo",
      targetLengthSeconds: 22,
    });
    const score = scoreVideo({
      hook: "Your SaaS onboarding bleeds users every week",
      cta: "Book a Demo",
      platform: "tiktok",
      productionMode: "fast_slides",
      scenes: plan.scenes,
      totalDurationSeconds: plan.total_duration_seconds,
      targetDurationSeconds: 22,
      mp4Url: "https://example.com/final.mp4",
      trendConfidence: 0.7,
      missingEvidence: [],
      slideQualityPassed: true,
      silentVoiceover: true,
      voiceQualityPenalty: 0.25,
    });
    expect(isSchedulable(score)).toBe(false);
    expect(score.block_reason).toContain("Silent");
  });
});
