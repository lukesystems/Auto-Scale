import { describe, expect, it } from "vitest";
import {
  PlatformPatternSchema,
  VideoTrendReportSchema,
} from "@/services/growth-run/schema";
import { normalizePreferredLengthSeconds } from "@/services/growth-run/normalize-preferred-length";

describe("normalizePreferredLengthSeconds", () => {
  it("passes through [min, max]", () => {
    expect(normalizePreferredLengthSeconds([15, 30])).toEqual([15, 30]);
  });

  it("duplicates a single-element array", () => {
    expect(normalizePreferredLengthSeconds([30])).toEqual([30, 30]);
  });

  it("duplicates a single number", () => {
    expect(normalizePreferredLengthSeconds(30)).toEqual([30, 30]);
  });

  it("returns undefined for empty array", () => {
    expect(normalizePreferredLengthSeconds([])).toBeUndefined();
  });

  it("returns undefined for null", () => {
    expect(normalizePreferredLengthSeconds(null)).toBeUndefined();
  });

  it("swaps when max is lower than min", () => {
    expect(normalizePreferredLengthSeconds([45, 15])).toEqual([15, 45]);
  });

  it("clamps to short-form limits", () => {
    expect(normalizePreferredLengthSeconds([2, 300])).toEqual([6, 180]);
  });
});

describe("PlatformPatternSchema preferred_length_seconds", () => {
  const base = {
    platform: "tiktok" as const,
    preferred_aspect_ratio: "9:16",
  };

  it("accepts [15, 30]", () => {
    const parsed = PlatformPatternSchema.parse({
      ...base,
      preferred_length_seconds: [15, 30],
    });
    expect(parsed.preferred_length_seconds).toEqual([15, 30]);
  });

  it("normalizes [30] to [30, 30]", () => {
    const parsed = PlatformPatternSchema.parse({
      ...base,
      preferred_length_seconds: [30],
    });
    expect(parsed.preferred_length_seconds).toEqual([30, 30]);
  });

  it("normalizes 30 to [30, 30]", () => {
    const parsed = PlatformPatternSchema.parse({
      ...base,
      preferred_length_seconds: 30,
    });
    expect(parsed.preferred_length_seconds).toEqual([30, 30]);
  });

  it("drops empty arrays", () => {
    const parsed = PlatformPatternSchema.parse({
      ...base,
      preferred_length_seconds: [],
    });
    expect(parsed.preferred_length_seconds).toBeUndefined();
  });

  it("drops null", () => {
    const parsed = PlatformPatternSchema.parse({
      ...base,
      preferred_length_seconds: null,
    });
    expect(parsed.preferred_length_seconds).toBeUndefined();
  });
});

describe("VideoTrendReportSchema regression", () => {
  const minimalReport = {
    winning_structures: [
      {
        name: "Hook → demo → CTA",
        beats: ["hook", "demo", "cta"],
        ideal_length_seconds: 22,
        why_it_works: "Fast proof",
      },
    ],
    hook_patterns: [{ label: "Pain hook", pattern: "Still doing X manually?" }],
    opening_frames: ["Screen recording of the pain"],
    cta_patterns: [{ label: "Try free", pattern: "Link in bio" }],
    platform_patterns: [
      {
        platform: "tiktok",
        preferred_length_seconds: [15, 30],
        preferred_aspect_ratio: "9:16",
      },
      {
        platform: "instagram",
        preferred_length_seconds: [30],
        preferred_aspect_ratio: "9:16",
      },
      {
        platform: "youtube",
        preferred_length_seconds: [20, 45],
        preferred_aspect_ratio: "9:16",
      },
    ],
    recommended_experiments: [
      {
        hypothesis: "Pain-led demo converts",
        video_type: "demo",
        platform: "tiktok",
        ideal_length_seconds: 22,
        estimated_variants: 3,
        rationale: "Evidence shows demo beats perform",
      },
    ],
    competitor_gaps: ["No founder POV"],
    repurposable_formats: ["Screen demo"],
    audience_language: ["manual workflow"],
    confidence: 0.6,
  };

  it("parses a full report when one platform pattern has [30]", () => {
    const parsed = VideoTrendReportSchema.parse(minimalReport);
    expect(parsed.platform_patterns[1]?.preferred_length_seconds).toEqual([30, 30]);
    expect(parsed.platform_patterns).toHaveLength(3);
  });
});
