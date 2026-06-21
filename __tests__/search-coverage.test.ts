import { describe, it, expect } from "vitest";
import { mergeSearchHits } from "@/services/intelligence/discovery/search-coverage";
import { inferSourceType } from "@/services/intelligence/discovery/dedupe-candidates";
import {
  scoreCandidate,
  type BriefScoringContext,
} from "@/services/intelligence/discovery/score-candidate";
import type { NormalizedCandidate } from "@/services/intelligence/discovery/dedupe-candidates";
import { buildCandidateSaveMetadata } from "@/services/intelligence/discovery/candidate-metadata";

function candidate(overrides: Partial<NormalizedCandidate> & { url: string }): NormalizedCandidate {
  return {
    title: overrides.title ?? "Example",
    snippet: overrides.snippet ?? "A useful snippet about Roblox UI tools for developers.",
    platform: overrides.platform ?? "other",
    sourceType: overrides.sourceType ?? "competitor_homepage",
    adapter: overrides.adapter ?? "exa",
    discoveryQuery: overrides.discoveryQuery ?? "roblox ui tool",
    discoveryReason: overrides.discoveryReason ?? "Find competitors",
    relevanceScore: overrides.relevanceScore ?? 0.5,
    accountHandle: overrides.accountHandle ?? null,
    canonicalUrl: overrides.canonicalUrl ?? overrides.url,
    url: overrides.url,
  };
}

const scoringContext: BriefScoringContext = {
  productName: "HUDForge",
  category: "Roblox UI tool",
  targetCustomer: "Roblox developers",
  primaryPain: "blank canvas UI design",
  marketCategory: "Game development tools",
  keywords: new Set(["roblox", "developers", "tool", "interface", "design"]),
};

describe("search-coverage.mergeSearchHits", () => {
  it("merges duplicate URLs across adapters and boosts coverage score", () => {
    const merged = mergeSearchHits(
      [
        {
          adapter: "exa",
          results: [
            { url: "https://roui.dev", title: "RoUI", snippet: "Roblox UI", publishedAt: null },
          ],
        },
        {
          adapter: "brave",
          results: [
            { url: "https://www.roui.dev/", title: "RoUI homepage", snippet: "Roblox UI toolkit", publishedAt: null },
          ],
        },
      ],
      10
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].adapters).toEqual(expect.arrayContaining(["exa", "brave"]));
    expect(merged[0].coverageScore).toBeGreaterThan(0.9);
    expect(merged[0].snippet).toBe("Roblox UI toolkit");
  });

  it("returns strongest hits first and respects limit", () => {
    const merged = mergeSearchHits(
      [
        {
          adapter: "exa",
          results: [
            { url: "https://a.com", title: "A", snippet: null, publishedAt: null },
            { url: "https://b.com", title: "B", snippet: null, publishedAt: null },
          ],
        },
      ],
      1
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].url).toBe("https://a.com");
  });

  it("isolates adapter batches — empty adapter does not remove other results", () => {
    const merged = mergeSearchHits(
      [
        { adapter: "exa", results: [] },
        {
          adapter: "brave",
          results: [{ url: "https://only-brave.com", title: "Brave", snippet: null, publishedAt: null }],
        },
      ],
      5
    );

    expect(merged).toHaveLength(1);
    expect(merged[0].adapters).toEqual(["brave"]);
  });
});

describe("discovery.inferSourceType", () => {
  it("detects competitor pricing pages", () => {
    expect(inferSourceType("https://acme.com/pricing", "competitor")).toBe("competitor_pricing");
  });

  it("detects reddit pain threads", () => {
    expect(inferSourceType("https://reddit.com/r/roblox/comments/abc/thread", "community")).toBe(
      "community_pain"
    );
  });

  it("detects comparison pages", () => {
    expect(inferSourceType("https://alternativeto.net/software/hudforge/", "comparison")).toBe(
      "comparison"
    );
  });

  it("detects social posts vs creator accounts on X", () => {
    expect(inferSourceType("https://x.com/founder/status/123", "creator")).toBe("social_post");
    expect(inferSourceType("https://x.com/founder", "creator")).toBe("creator_account");
  });

  it("detects competitor homepages", () => {
    expect(inferSourceType("https://roui.dev", "competitor")).toBe("competitor_homepage");
  });
});

describe("discovery.scoreCandidate", () => {
  it("scores competitor homepages higher than unknown blogs", () => {
    const strong = scoreCandidate({
      candidate: candidate({
        url: "https://roui.dev",
        sourceType: "competitor_homepage",
        title: "RoUI for Roblox developers",
      }),
      intent: "competitor",
      context: scoringContext,
      coverageScore: 1.1,
    });

    const weak = scoreCandidate({
      candidate: candidate({
        url: "https://random-blog.com/post",
        sourceType: "unknown",
        title: "Misc",
        snippet: "short",
      }),
      intent: "competitor",
      context: scoringContext,
    });

    expect(strong.strategicValue).toBeGreaterThan(weak.strategicValue);
    expect(strong.competitorLikelihood).toBeGreaterThan(weak.competitorLikelihood);
    expect(strong.reasons.length).toBeGreaterThan(0);
  });

  it("rewards multi-adapter coverage in evidence richness", () => {
    const multi = scoreCandidate({
      candidate: candidate({ url: "https://a.com", adapter: "exa+brave" }),
      intent: "competitor",
      context: scoringContext,
      coverageScore: 1.2,
    });
    const single = scoreCandidate({
      candidate: candidate({ url: "https://a.com", adapter: "exa" }),
      intent: "competitor",
      context: scoringContext,
    });

    expect(multi.evidenceRichness).toBeGreaterThan(single.evidenceRichness);
    expect(multi.strategicValue).toBeGreaterThanOrEqual(single.strategicValue);
  });
});

describe("discovery.candidate-metadata", () => {
  it("stores quality score reasons in metadata", () => {
    const quality = scoreCandidate({
      candidate: candidate({ url: "https://roui.dev/pricing" }),
      intent: "competitor",
      context: scoringContext,
    });

    const metadata = buildCandidateSaveMetadata(
      {
        ...candidate({ url: "https://roui.dev/pricing" }),
        enrichStatus: "enriched",
        enrichError: null,
        enrichedTitle: "Pricing",
        enrichedSnippet: "Plans",
        fetchMetadata: { fetch_status: "success" },
      },
      quality
    ) as { quality?: { reasons?: string[]; strategic_value?: number } };

    expect(metadata.quality?.strategic_value).toBe(quality.strategicValue);
    expect(metadata.quality?.reasons?.length).toBeGreaterThan(0);
  });
});
