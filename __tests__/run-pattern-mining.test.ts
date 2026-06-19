import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/services/intelligence/patterns/save-pattern-run", () => ({
  savePatternRun: vi.fn(async (input: { runId?: string }) => input.runId ?? "run-1"),
}));

vi.mock("@/services/intelligence/patterns/save-patterns", () => ({
  savePatterns: vi.fn(async () => ["pattern-1"]),
}));

vi.mock("@/services/intelligence/patterns/load-pattern-context", () => ({
  loadPatternMiningContext: vi.fn(async () => ({
    projectId: "project-1",
    brief: null,
    facts: [],
    sources: [
      {
        id: "s1",
        source_url: "https://example.com/a",
        platform: "x",
        hook: "Stop guessing what to post",
        angle: "distribution",
        format: "thread",
        cta_pattern: "Try free",
        visual_pattern: null,
        audience_pain: "Founders do not know what to post",
        why_it_worked: "Clear pain",
        how_to_adapt: null,
        fetched_text: null,
        notes: null,
        caption: null,
      },
      {
        id: "s2",
        source_url: "https://example.com/b",
        platform: "linkedin",
        hook: "Stop guessing what to post!",
        angle: "distribution",
        format: "carousel",
        cta_pattern: "Try free",
        visual_pattern: "carousel",
        audience_pain: "Founders do not know what to post after shipping",
        why_it_worked: "Specific pain",
        how_to_adapt: "Founder-led distribution",
        fetched_text: null,
        notes: null,
        caption: null,
      },
    ],
  })),
}));

vi.mock("@/services/ai/runtime", () => ({
  generateObject: vi.fn(async () => {
    throw new Error("AI unavailable");
  }),
}));

describe("run-pattern-mining", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("mines deterministic patterns when AI consolidation fails", async () => {
    const { runPatternMining } = await import("@/services/intelligence/patterns/run-pattern-mining");
    const result = await runPatternMining({ projectId: "project-1" });

    expect(result.ok).toBe(true);
    expect(result.patternCount).toBeGreaterThan(0);
    expect(result.usedAi).toBe(false);
    expect(result.patterns.every((pattern) => pattern.evidence.length > 0)).toBe(true);
  });

  it("fails cleanly when no sources exist", async () => {
    const { loadPatternMiningContext } = await import("@/services/intelligence/patterns/load-pattern-context");
    vi.mocked(loadPatternMiningContext).mockResolvedValueOnce({
      projectId: "project-1",
      brief: null,
      facts: [],
      sources: [],
    });

    const { runPatternMining } = await import("@/services/intelligence/patterns/run-pattern-mining");
    const result = await runPatternMining({ projectId: "project-1" });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("No accepted TrendWatch sources");
  });
});
