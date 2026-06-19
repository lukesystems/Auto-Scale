import { describe, it, expect } from "vitest";
import { filterPatternsWithEvidence } from "@/services/intelligence/patterns/cluster-patterns";
import type { MinedPattern } from "@/services/intelligence/patterns/schema";

describe("pattern-evidence", () => {
  it("refuses to save patterns without evidence", () => {
    const invalid = {
      patternType: "hook",
      label: "Ghost pattern",
      summary: "Should not save",
      whyItMatters: "n/a",
      howToUse: "n/a",
      supportCount: 0,
      confidence: "medium",
      sourceIds: [],
      examples: [],
      evidence: [],
    } as MinedPattern;

    expect(filterPatternsWithEvidence([invalid])).toHaveLength(0);
  });

  it("allows low-confidence patterns with one evidence item", () => {
    const pattern: MinedPattern = {
      patternType: "pain",
      label: "Founder posting pain",
      summary: "Repeated pain",
      whyItMatters: "Important",
      howToUse: "Use in content",
      supportCount: 1,
      confidence: "low",
      sourceIds: ["s1"],
      examples: ["Founders do not know what to post"],
      evidence: [
        {
          sourceId: "s1",
          sourceUrl: "https://example.com",
          evidenceField: "audience_pain",
          evidenceText: "Founders do not know what to post",
        },
      ],
    };

    expect(filterPatternsWithEvidence([pattern])).toHaveLength(1);
  });

  it("requires two evidence items for medium confidence", () => {
    const pattern: MinedPattern = {
      patternType: "hook",
      label: "Hook",
      summary: "Repeated hook",
      whyItMatters: "Important",
      howToUse: "Use it",
      supportCount: 1,
      confidence: "medium",
      sourceIds: ["s1"],
      examples: ["Hook text"],
      evidence: [
        {
          sourceId: "s1",
          sourceUrl: "https://example.com",
          evidenceField: "hook",
          evidenceText: "Hook text",
        },
      ],
    };

    expect(filterPatternsWithEvidence([pattern])).toHaveLength(0);
  });
});
