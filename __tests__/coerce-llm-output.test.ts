import { describe, expect, it } from "vitest";

import { StoryboardSchema } from "@/services/growth-run/schema";
import { SourceClassificationSchema } from "@/services/trendwatch/schema";
import { DeepDiscoveryActionSchema } from "@/services/intelligence/deep-discovery/schema";
import { PatternConsolidationSchema } from "@/services/intelligence/patterns/schema";
import {
  coerceToString,
  parseFollowerCount,
  unwrapStructuredPayload,
} from "@/services/ai/coerce-llm-output";

describe("coerce-llm-output", () => {
  it("unwraps Storyboard wrapper and joins on_screen_text arrays", () => {
    const raw = {
      Storyboard: {
        aspect_ratio: "9:16",
        total_duration_seconds: 22,
        scenes: [
          {
            scene_index: 1,
            role: "hook",
            duration_seconds: 2,
            visual_intent: "text",
            on_screen_text: ["Hello", "world"],
            asset_method: "comparison",
          },
          {
            scene_index: 2,
            role: "cta",
            duration_seconds: 3,
            visual_intent: "cta",
            on_screen_text: ["Sign up"],
            asset_method: "slide",
          },
        ],
      },
    };
    const normalized = unwrapStructuredPayload(raw);
    const parsed = StoryboardSchema.parse(normalized);
    expect(parsed.scenes[0].on_screen_text).toBe("Hello world");
    expect(parsed.scenes[0].asset_method).toBe("slide");
  });

  it("unwraps source_classification and coerces follower_count", () => {
    const raw = {
      source_classification: {
        account_type: "mid-tier",
        follower_count: "8.2M",
        format: "",
        hook: "",
        angle: "",
        visual_pattern: "",
        cta_pattern: "",
        audience_pain: "",
        why_it_worked: "",
        how_to_adapt: "",
        transferability: "medium",
        distortion_risk: "low",
        confidence: "medium",
        evidence_notes: "",
      },
    };
    const normalized = unwrapStructuredPayload(raw);
    const parsed = SourceClassificationSchema.parse(normalized);
    expect(parsed.account_type).toBe("creator");
    expect(parsed.follower_count).toBe(8_200_000);
  });

  it("coerces discovery string queries into objects", () => {
    const raw = {
      next_queries: ["site:reddit.com roblox ui", "Figma vs Roblox"],
      hypotheses: "One hypothesis line",
    };
    const normalized = unwrapStructuredPayload(raw);
    const parsed = DeepDiscoveryActionSchema.parse(normalized);
    expect(parsed.next_queries).toHaveLength(2);
    expect(parsed.next_queries[0].query).toContain("reddit");
    expect(parsed.next_queries[0].reason).toBeTruthy();
    expect(parsed.hypotheses).toEqual(["One hypothesis line"]);
    expect(parsed.thought).toBeTruthy();
  });

  it("maps consolidated_patterns to patterns with defaults", () => {
    const raw = {
      consolidated_patterns: [
        {
          pattern: "Mid-tier TikTok creators",
          group_keys: ["hook:tiktok"],
          summary: "Engagement with TikTok",
        },
      ],
    };
    const normalized = unwrapStructuredPayload(raw);
    const parsed = PatternConsolidationSchema.parse(normalized);
    expect(parsed.patterns).toHaveLength(1);
    expect(parsed.patterns[0].label).toBeTruthy();
    expect(parsed.patterns[0].pattern_type).toBeTruthy();
  });

  it("parseFollowerCount handles unknown", () => {
    expect(parseFollowerCount("unknown")).toBeNull();
    expect(coerceToString(["a", "b"])).toBe("a b");
  });

  it("parses exact terminal storyboard failure (wrapped + array on_screen_text)", () => {
    const raw = {
      Storyboard: {
        aspect_ratio: "9:16",
        total_duration_seconds: 22,
        scenes: Array.from({ length: 6 }, (_, i) => ({
          scene_index: i + 1,
          role: i === 0 ? "hook" : i === 5 ? "cta" : "context",
          duration_seconds: 2,
          visual_intent: "text",
          on_screen_text: [`Line ${i + 1}`],
          voiceover_line: `VO ${i + 1}`,
          asset_method: i === 4 ? "comparison" : "slide",
        })),
      },
    };
    const parsed = StoryboardSchema.parse(unwrapStructuredPayload(raw));
    expect(parsed.scenes).toHaveLength(6);
    expect(parsed.scenes[0].on_screen_text).toBe("Line 1");
    expect(parsed.scenes[4].asset_method).toBe("slide");
  });

  it("parses exact terminal classify failure (follower_count unknown string)", () => {
    const raw = {
      platform: "tiktok",
      handle: "unknown",
      account_type: "creator",
      follower_count: "unknown",
      evidence: "Mid-tier TikTok creators",
    };
    const parsed = SourceClassificationSchema.parse(unwrapStructuredPayload(raw));
    expect(parsed.follower_count).toBeNull();
    expect(parsed.account_type).toBe("creator");
  });
});
