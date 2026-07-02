import { describe, expect, it } from "vitest";
import { matchInsightForHook } from "@/lib/match-hook-insight";

describe("matchInsightForHook", () => {
  const insights = [
    {
      id: "insight-1",
      insight: "Competitors win with founder-led pain hooks",
      hook_pattern: "founder pain confession",
    },
    {
      id: "insight-2",
      insight: "Carousel teardown posts drive saves",
      hook_pattern: "before/after teardown",
    },
  ];

  it("matches by hook_pattern overlap first", () => {
    expect(matchInsightForHook("My founder pain confession about churn", insights)).toBe("insight-1");
  });

  it("falls back to token overlap with insight text", () => {
    expect(matchInsightForHook("Carousel teardown saves", insights)).toBe("insight-2");
  });

  it("returns null when no insights exist", () => {
    expect(matchInsightForHook("Any hook", [])).toBeNull();
  });
});
