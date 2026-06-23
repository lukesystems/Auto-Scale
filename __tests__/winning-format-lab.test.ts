import { describe, expect, it } from "vitest";
import { WinningFormatPlanSchema } from "@/services/winning-format/schema";
import { createFingerprintKey } from "@/services/video-factory/concepts";

const FORMAT = {
  format_name: "Pain led SaaS demo",
  video_type: "demo" as const,
  platform: "tiktok" as const,
  target_length_seconds: 24,
  hook_mechanism: "Call out the expensive manual workflow",
  visual_grammar: "Problem screen, product shortcut, result screen",
  script_structure: ["pain", "mechanism", "demo", "result", "cta"],
  cta_pattern: "Try the workflow",
  business_hypothesis: "A concrete demo will generate qualified clicks",
  transferability_score: 0.8,
  distortion_risk: "low" as const,
  confidence: 0.72,
  missing_evidence: [],
  evidence_video_ids: ["11111111-1111-4111-8111-111111111111"],
  source_pattern_ids: ["22222222-2222-4222-8222-222222222222"],
  observed_evidence: ["Pain-first demos recur in the evidence set"],
  strategic_inference: ["The structure may transfer to this product"],
  variants: ["A", "B", "C"].map((label) => ({
    variant_label: label,
    hook: `${label}: stop doing this workflow manually`,
    angle: "Same pain and body; only the hook wording changes",
    promise: "Show the faster workflow",
    hypothesis: `Hook ${label} improves qualified attention`,
    expected_signal: "Three-second hold plus tracked clicks",
  })),
};

describe("Winning Format Lab contracts", () => {
  it("accepts one controlled format with exactly three hook variants", () => {
    const plan = WinningFormatPlanSchema.parse({
      audience_pain: "The workflow takes too long",
      fixed_body: "Show the same problem, product mechanism, and result",
      fixed_cta: "Try the product",
      fixed_audience: "Technical SaaS founders",
      tested_variable: "hook",
      evaluation_window_days: 3,
      formats: [FORMAT],
    });

    expect(plan.formats).toHaveLength(1);
    expect(plan.formats[0]?.variants).toHaveLength(3);
    expect(new Set(plan.formats[0]?.variants.map((variant) => variant.hook)).size).toBe(3);
  });

  it("rejects uncontrolled batches with more than three variants", () => {
    const result = WinningFormatPlanSchema.safeParse({
      audience_pain: "The workflow takes too long",
      fixed_body: "Keep the body fixed",
      fixed_cta: "Try the product",
      fixed_audience: "Technical SaaS founders",
      tested_variable: "hook",
      evaluation_window_days: 3,
      formats: [{ ...FORMAT, variants: [...FORMAT.variants, FORMAT.variants[0]] }],
    });

    expect(result.success).toBe(false);
  });

  it("creates a stable format fingerprint key", () => {
    expect(createFingerprintKey(FORMAT)).toBe("demo:tiktok:pain-led-saas-demo");
  });
});
