import { describe, it, expect } from "vitest";
import {
  canonicalizeUrl,
  dedupeCandidates,
  normalizeSearchResults,
} from "@/services/intelligence/discovery/dedupe-candidates";
import { buildFallbackDiscoveryPlan } from "@/services/intelligence/discovery/plan-discovery";
import { DiscoveryPlanSchema } from "@/services/intelligence/discovery/schema";

describe("discovery.dedupe-candidates", () => {
  it("dedupes by canonical URL", () => {
    const candidates = dedupeCandidates([
      {
        url: "https://www.example.com/pricing/",
        canonicalUrl: canonicalizeUrl("https://www.example.com/pricing/"),
        title: "Pricing",
        snippet: null,
        platform: "other",
        sourceType: "competitor",
        adapter: "exa",
        discoveryQuery: "q1",
        discoveryReason: "r1",
        relevanceScore: 0.9,
        accountHandle: null,
      },
      {
        url: "https://example.com/pricing",
        canonicalUrl: canonicalizeUrl("https://example.com/pricing"),
        title: "Pricing page",
        snippet: null,
        platform: "other",
        sourceType: "competitor",
        adapter: "exa",
        discoveryQuery: "q1",
        discoveryReason: "r1",
        relevanceScore: 0.8,
        accountHandle: null,
      },
    ]);

    expect(candidates).toHaveLength(1);
  });

  it("ignores external duplicates by platform handle", () => {
    const candidates = dedupeCandidates([
      {
        url: "https://x.com/founder/status/1",
        canonicalUrl: "https://x.com/founder/status/1",
        title: "Post 1",
        snippet: null,
        platform: "x",
        sourceType: "creator",
        adapter: "exa",
        discoveryQuery: "q1",
        discoveryReason: "r1",
        relevanceScore: 0.9,
        accountHandle: "founder",
      },
      {
        url: "https://x.com/founder/status/2",
        canonicalUrl: "https://x.com/founder/status/2",
        title: "Post 2",
        snippet: null,
        platform: "x",
        sourceType: "creator",
        adapter: "exa",
        discoveryQuery: "q1",
        discoveryReason: "r1",
        relevanceScore: 0.8,
        accountHandle: "founder",
      },
    ]);

    expect(candidates).toHaveLength(1);
  });

  it("normalizes search results with platform inference", () => {
    const normalized = normalizeSearchResults({
      results: [{ url: "https://reddit.com/r/saas/comments/abc", title: "Pain thread", snippet: "help", publishedAt: null }],
      adapter: "exa",
      query: "saas pain",
      reason: "community",
      intent: "community",
    });

    expect(normalized[0]?.platform).toBe("reddit");
    expect(normalized[0]?.sourceType).toBe("community");
  });
});

describe("discovery.plan-discovery", () => {
  it("builds a valid fallback plan", () => {
    const plan = buildFallbackDiscoveryPlan({
      projectId: "p1",
      latestCrawlId: null,
      facts: [],
      brief: {
        id: "b1",
        project_id: "p1",
        category: "AI distribution tool",
        market_category: "marketing SaaS",
        target_customer: "technical founders",
        primary_pain: "inconsistent distribution",
      } as never,
    });

    const parsed = DiscoveryPlanSchema.safeParse(plan);
    expect(parsed.success).toBe(true);
    expect(plan.queries.length).toBeGreaterThanOrEqual(3);
  });
});
