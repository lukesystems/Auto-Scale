import { describe, it, expect } from "vitest";
import { scorePattern, scorePatterns } from "@/services/intelligence/scoring/score-patterns";
import type { MinedPattern } from "@/services/intelligence/patterns/schema";
import type { MineableSourceRow } from "@/services/intelligence/patterns/load-pattern-context";
import type { PatternMiningContext } from "@/services/intelligence/patterns/load-pattern-context";

const sources: MineableSourceRow[] = [
  {
    id: "s1",
    project_id: "p1",
    source_url: "https://example.com/a",
    platform: "x",
    account_type: "competitor",
    caption: null,
    hook: "Stop guessing what to post",
    angle: "distribution",
    format: "thread",
    cta_pattern: "Try free",
    visual_pattern: null,
    audience_pain: "Founders do not know what to post",
    why_it_worked: "Clear pain",
    how_to_adapt: "Founder-led distribution",
    fetched_text: null,
    notes: null,
    confidence_score: 0.7,
    fetch_status: "success",
  },
  {
    id: "s2",
    project_id: "p1",
    source_url: "https://example.com/b",
    platform: "linkedin",
    account_type: "shadow",
    caption: null,
    hook: "Stop guessing what to post",
    angle: "distribution",
    format: "carousel",
    cta_pattern: "Try free",
    visual_pattern: null,
    audience_pain: "Founders do not know what to post after shipping",
    why_it_worked: "Specific pain",
    how_to_adapt: "Founder-led distribution",
    fetched_text: null,
    notes: null,
    confidence_score: 0.7,
    fetch_status: "success",
  },
];

const context: PatternMiningContext = {
  projectId: "p1",
  brief: null,
  facts: [],
  sources,
};

const pattern: MinedPattern = {
  patternType: "hook",
  label: "Stop guessing what to post",
  summary: "Repeated founder distribution hook",
  whyItMatters: "Matches audience pain",
  howToUse: "Lead with the pain in founder posts",
  supportCount: 2,
  confidence: "medium",
  sourceIds: ["s1", "s2"],
  examples: ["Stop guessing what to post"],
  evidence: [
    {
      sourceId: "s1",
      sourceUrl: "https://example.com/a",
      evidenceField: "hook",
      evidenceText: "Stop guessing what to post",
    },
    {
      sourceId: "s2",
      sourceUrl: "https://example.com/b",
      evidenceField: "hook",
      evidenceText: "Stop guessing what to post",
    },
  ],
};

describe("score-patterns", () => {
  it("increases strength with higher support_count", () => {
    const sourcesById = new Map(sources.map((source) => [source.id, source]));
    const cache = new Map();

    const lowSupport = scorePattern(
      { ...pattern, supportCount: 1 },
      sourcesById,
      context,
      cache
    );
    const highSupport = scorePattern(pattern, sourcesById, context, cache);

    expect(highSupport.strengthScore).toBeGreaterThan(lowSupport.strengthScore);
  });

  it("rolls up source scores for each pattern", () => {
    const scored = scorePatterns([pattern], sources, context);
    expect(scored).toHaveLength(1);
    expect(scored[0].scores.sourceScores).toHaveLength(2);
    expect(scored[0].scores.strengthScore).toBeGreaterThan(0);
    expect(scored[0].scores.transferabilityScore).toBeGreaterThan(0);
    expect(scored[0].scores.signalConfidence).toBeGreaterThan(0);
    expect(scored[0].scores.scoreReasons.length).toBeGreaterThan(0);
  });

  it("caps confidence when source metric coverage is incomplete", () => {
    const scored = scorePatterns([pattern], sources, context)[0].scores;
    expect(scored.signalConfidence).toBeLessThan(1);
    expect(scored.scoreReasons.some((reason) => reason.includes("save/recency"))).toBe(true);
  });
});
