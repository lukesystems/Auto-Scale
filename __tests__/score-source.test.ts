import { describe, it, expect } from "vitest";
import {
  extractBriefKeywords,
  getSourceSignalText,
  scoreAccountFit,
  scoreConversionIntent,
  scoreFormatTransferability,
  scoreRelevance,
  scoreSource,
} from "@/services/intelligence/scoring/score-source";
import type { MineableSourceRow } from "@/services/intelligence/patterns/load-pattern-context";
import type { PatternMiningContext } from "@/services/intelligence/patterns/load-pattern-context";

const baseSource: MineableSourceRow = {
  id: "s1",
  project_id: "p1",
  source_url: "https://example.com/post",
  platform: "linkedin",
  account_type: "competitor",
  caption: null,
  hook: "Stop guessing what to post",
  angle: "distribution",
  format: "carousel",
  cta_pattern: "Try free",
  visual_pattern: null,
  audience_pain: "Founders do not know what to post",
  why_it_worked: "Clear pain",
  how_to_adapt: "Founder-led distribution",
  fetched_text: null,
  notes: null,
  confidence_score: 0.7,
  fetch_status: "success",
};

const contextWithBrief: PatternMiningContext = {
  projectId: "p1",
  brief: {
    product_name: "AutoScale",
    one_line_description: "Growth intelligence for founders",
    primary_pain: "distribution",
    target_customer: "technical founders",
    product_summary: "Helps founders understand distribution",
  } as PatternMiningContext["brief"],
  facts: [],
  sources: [baseSource],
};

describe("score-source", () => {
  it("returns null relevance when brief keywords are unavailable", () => {
    const context: PatternMiningContext = {
      projectId: "p1",
      brief: null,
      facts: [],
      sources: [baseSource],
    };

    const scored = scoreSource(baseSource, context);
    expect(scored.relevance).toBeNull();
    expect(scored.confidenceScore).toBeLessThan(1);
    expect(scored.reasons.some((reason) => reason.includes("Missing data"))).toBe(true);
  });

  it("scores higher relevance when source text overlaps brief keywords", () => {
    const keywords = extractBriefKeywords(contextWithBrief);
    const sourceText = getSourceSignalText(baseSource);
    const relevance = scoreRelevance(sourceText, keywords);

    expect(relevance).not.toBeNull();
    expect(relevance!).toBeGreaterThan(0);
  });

  it("scores format transferability from format and how_to_adapt fields", () => {
    expect(scoreFormatTransferability(baseSource)).toBeGreaterThan(0.7);
    expect(scoreFormatTransferability({ ...baseSource, format: null, how_to_adapt: null })).toBeLessThan(0.5);
  });

  it("scores conversion intent from CTA and offer language", () => {
    expect(scoreConversionIntent(baseSource)).toBeGreaterThan(0.5);
    expect(scoreConversionIntent({ ...baseSource, cta_pattern: null, notes: "free trial available" })).toBeGreaterThan(0.35);
  });

  it("prefers competitor and shadow account types for account fit", () => {
    expect(scoreAccountFit("competitor")).toBeGreaterThan(scoreAccountFit("partner"));
  });
});
