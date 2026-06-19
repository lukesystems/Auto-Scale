import { describe, it, expect } from "vitest";
import {
  groupSignalsDeterministically,
  normalizeSignalText,
  patternsFromGroups,
  filterPatternsWithEvidence,
} from "@/services/intelligence/patterns/cluster-patterns";
import type { SourceSignalBucket } from "@/services/intelligence/patterns/schema";

describe("cluster-patterns", () => {
  it("clusters duplicate/similar hook patterns", () => {
    const buckets: SourceSignalBucket[] = [
      {
        sourceId: "s1",
        sourceUrl: "https://a.com",
        platform: "x",
        signals: {
          hook: [{ text: "Stop guessing what to post", field: "hook" }],
          pain: [],
          angle: [],
          format: [],
          cta: [],
          visual: [],
          offer: [],
          positioning: [],
        },
      },
      {
        sourceId: "s2",
        sourceUrl: "https://b.com",
        platform: "linkedin",
        signals: {
          hook: [{ text: "Stop guessing what to post!", field: "hook" }],
          pain: [],
          angle: [],
          format: [],
          cta: [],
          visual: [],
          offer: [],
          positioning: [],
        },
      },
    ];

    const groups = groupSignalsDeterministically(buckets);
    expect(groups).toHaveLength(1);
    expect(groups[0]?.items).toHaveLength(2);
  });

  it("normalizes filler words for grouping", () => {
    expect(normalizeSignalText("The Stop Guessing What To Post")).toContain("stop guessing");
  });

  it("refuses medium-confidence patterns without 2+ evidence items", () => {
    const groups = groupSignalsDeterministically([
      {
        sourceId: "s1",
        sourceUrl: "https://a.com",
        platform: "x",
        signals: {
          hook: [{ text: "Unique hook one", field: "hook" }],
          pain: [],
          angle: [],
          format: [],
          cta: [],
          visual: [],
          offer: [],
          positioning: [],
        },
      },
    ]);

    const patterns = filterPatternsWithEvidence(patternsFromGroups(groups));
    expect(patterns).toHaveLength(1);
    expect(patterns[0]?.confidence).toBe("low");
  });
});
