import { describe, expect, it } from "vitest";
import { validateHookPatterns } from "@/services/videotrend/validate-hook-patterns";
import {
  enforceFormatEvidence,
  normalizeFormatEvidence,
  rankEvidenceRows,
} from "@/services/video-factory/enforce-format-evidence";
import type { FormatHypothesis } from "@/services/winning-format/schema";

const EVIDENCE = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    url: "https://tiktok.com/@creator/video/123",
    platform: "tiktok",
    handle: "creator",
  },
  {
    id: "22222222-2222-4222-8222-222222222222",
    url: "https://instagram.com/reel/abc",
    platform: "instagram",
    handle: "brand",
  },
  {
    id: "33333333-3333-4333-8333-333333333333",
    url: "https://youtube.com/shorts/xyz",
    platform: "youtube",
    handle: "channel",
  },
];

const BASE_FORMAT: FormatHypothesis = {
  format_name: "Pain led SaaS demo",
  video_type: "demo",
  platform: "tiktok",
  target_length_seconds: 24,
  hook_mechanism: "Call out manual workflow pain",
  visual_grammar: "Problem, demo, result",
  script_structure: ["pain", "demo", "cta"],
  cta_pattern: "Try it",
  business_hypothesis: "Demo drives clicks",
  transferability_score: 0.7,
  distortion_risk: "low",
  confidence: 0.6,
  missing_evidence: [],
  evidence_video_ids: [],
  source_pattern_ids: [],
  observed_evidence: ["Trend report recommends demos"],
  strategic_inference: ["Demo should convert"],
  variants: ["A", "B", "C"].map((label) => ({
    variant_label: label,
    hook: `${label} hook`,
    angle: "Pain",
    promise: "Faster workflow",
    hypothesis: "Hook wins attention",
    expected_signal: "Clicks",
  })),
};

describe("VideoTrend hook reference_url validation", () => {
  it("keeps hooks whose reference_url is in the evidence set", () => {
    const result = validateHookPatterns(
      {
        confidence: 0.7,
        hook_patterns: [
          {
            label: "Valid",
            pattern: "Stop doing X manually",
            reference_url: "https://tiktok.com/@creator/video/123",
          },
          {
            label: "Invalid",
            pattern: "Invented hook",
            reference_url: "https://tiktok.com/@fake/video/999",
          },
        ],
      },
      EVIDENCE
    );

    expect(result.hook_patterns).toHaveLength(1);
    expect(result.hook_patterns[0]?.label).toBe("Valid");
    expect(result.validation.dropped_count).toBe(1);
    expect(result.confidence).toBeLessThan(0.7);
  });

  it("keeps a low-confidence fallback when every hook is dropped", () => {
    const result = validateHookPatterns(
      {
        confidence: 0.6,
        hook_patterns: [
          {
            label: "Bad",
            pattern: "Fake pattern",
            reference_url: "https://example.com/not-in-evidence",
          },
        ],
      },
      EVIDENCE
    );

    expect(result.hook_patterns).toHaveLength(1);
    expect(result.hook_patterns[0]?.reference_url).toBe(EVIDENCE[0]!.url);
    expect(result.validation.kept_fallback).toBe(true);
    expect(result.confidence).toBeLessThanOrEqual(0.25);
  });

  it("normalizes trailing slashes when matching evidence URLs", () => {
    const result = validateHookPatterns(
      {
        confidence: 0.8,
        hook_patterns: [
          {
            label: "Slash",
            pattern: "Hook",
            reference_url: "https://tiktok.com/@creator/video/123/",
          },
        ],
      },
      EVIDENCE
    );

    expect(result.hook_patterns).toHaveLength(1);
    expect(result.validation.dropped_count).toBe(0);
  });
});

describe("Concept format evidence enforcement", () => {
  it("auto-assigns top-ranked platform-matched evidence when LLM left ids empty", () => {
    const ranked = rankEvidenceRows([
      { id: EVIDENCE[2]!.id, platform: "youtube", view_count: 500_000, source_confidence: 0.9 },
      { id: EVIDENCE[0]!.id, platform: "tiktok", view_count: 100_000, source_confidence: 0.8 },
      { id: EVIDENCE[1]!.id, platform: "instagram", view_count: 50_000, source_confidence: 0.7 },
    ]);

    const enforced = enforceFormatEvidence(
      BASE_FORMAT,
      EVIDENCE.map((row) => row.id),
      ranked
    );

    expect(enforced.evidence_video_ids).toEqual([EVIDENCE[0]!.id]);
    expect(enforced.observed_evidence.some((line) => line.includes("Auto-assigned"))).toBe(true);
    expect(enforced.confidence).toBeLessThanOrEqual(0.45);
  });

  it("does not auto-assign when fewer than 3 evidence ids are available", () => {
    const enforced = enforceFormatEvidence(
      BASE_FORMAT,
      [EVIDENCE[0]!.id, EVIDENCE[1]!.id],
      rankEvidenceRows([{ id: EVIDENCE[0]!.id, platform: "tiktok", view_count: 1, source_confidence: 0.5 }])
    );

    expect(enforced.evidence_video_ids).toHaveLength(0);
  });

  it("filters unknown evidence ids then enforces assignment", () => {
    const normalized = normalizeFormatEvidence(
      { ...BASE_FORMAT, evidence_video_ids: ["00000000-0000-4000-8000-000000000099"] },
      new Set(EVIDENCE.map((row) => row.id)),
      new Set()
    );

    const enforced = enforceFormatEvidence(
      normalized,
      EVIDENCE.map((row) => row.id),
      rankEvidenceRows(
        EVIDENCE.map((row, index) => ({
          id: row.id,
          platform: row.platform,
          view_count: index * 10_000,
          source_confidence: 0.5,
        }))
      )
    );

    expect(enforced.evidence_video_ids.length).toBeGreaterThan(0);
    expect(EVIDENCE.some((row) => row.id === enforced.evidence_video_ids[0])).toBe(true);
  });
});
