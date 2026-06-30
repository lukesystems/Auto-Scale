import { describe, expect, it } from "vitest";
import {
  runPreRenderGate,
  scanBannedClaims,
  scoreHook,
} from "@/services/video-factory/pre-render-gate";

const SCRIPT = {
  hook_line: "Your SaaS onboarding is bleeding users",
  body_lines: [
    "Founders waste hours on manual setup",
    "AutoScale turns your URL into video experiments",
    "Ship trend-backed shorts in one run",
  ],
  cta_line: "Try AutoScale free",
  voiceover_full:
    "Your SaaS onboarding is bleeding users Founders waste hours on manual setup AutoScale turns your URL into video experiments Ship trend-backed shorts in one run Try AutoScale free",
  on_screen_text: [],
  estimated_duration_seconds: 22,
};

describe("pre-render gate", () => {
  it("passes a well-formed concept with clean claims", () => {
    const result = runPreRenderGate({
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      script: SCRIPT,
      targetLengthSeconds: 22,
      sceneDurationsSeconds: [2.5, 3, 3, 3, 3],
      audioMode: "voiceover",
      trendConfidence: 0.55,
    });
    expect(result.passed).toBe(true);
    expect(result.checks.clean_claims).toBe(true);
    expect(result.hookScore).toBeGreaterThanOrEqual(5);
  });

  it("blocks banned superlative claims without receipt", () => {
    const result = runPreRenderGate({
      hook: "We are #1 guaranteed 10x growth overnight",
      cta: SCRIPT.cta_line,
      script: {
        ...SCRIPT,
        hook_line: "We are #1 guaranteed 10x growth overnight",
        voiceover_full: "We are #1 guaranteed 10x growth overnight",
      },
      targetLengthSeconds: 22,
      sceneDurationsSeconds: [5, 5, 5, 5],
      audioMode: "voiceover",
    });
    expect(result.passed).toBe(false);
    expect(result.grade).toBe("BLOCKED");
    expect(result.blockReasons.some((r) => r.includes("Banned claim"))).toBe(true);
  });

  it("allows music_only without WPM enforcement", () => {
    const result = runPreRenderGate({
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      script: { ...SCRIPT, voiceover_full: "short" },
      targetLengthSeconds: 22,
      sceneDurationsSeconds: [10, 10],
      audioMode: "music_only",
    });
    expect(result.checks.wpm_in_range).toBe(true);
  });

  it("flags low evidence until acknowledged", () => {
    const result = runPreRenderGate({
      hook: SCRIPT.hook_line,
      cta: SCRIPT.cta_line,
      script: SCRIPT,
      targetLengthSeconds: 22,
      sceneDurationsSeconds: [2.5, 3, 3, 3, 3],
      audioMode: "voiceover",
      trendConfidence: 0.2,
      lowEvidenceAcknowledged: false,
    });
    expect(result.checks.evidence_ok).toBe(false);
    expect(result.warnings.some((w) => w.includes("Low trend confidence"))).toBe(true);
  });

  it("auto-approve eligible on repeat runs with strong hook", () => {
    const result = runPreRenderGate({
      hook: "Stop losing signups on day one — here's the fix",
      cta: SCRIPT.cta_line,
      script: SCRIPT,
      targetLengthSeconds: 22,
      sceneDurationsSeconds: [3, 4, 4, 5, 3, 3],
      audioMode: "voiceover",
      trendConfidence: 0.5,
      isFirstRun: false,
    });
    expect(result.autoApproveEligible).toBe(true);
  });
});

describe("hook scoring helpers", () => {
  it("scores specific hooks higher than empty", () => {
    expect(scoreHook("")).toBe(0);
    expect(scoreHook("Why do 73% of founders churn in week one?")).toBeGreaterThan(6);
  });

  it("detects banned claim patterns", () => {
    expect(scanBannedClaims("Get 10x results guaranteed")).toContain("10x");
    expect(scanBannedClaims("Honest product walkthrough")).toEqual([]);
  });
});
