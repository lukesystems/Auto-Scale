import { describe, it, expect } from "vitest";
import { buildEnrichedDigest } from "@/services/intelligence/deep-discovery/run-deep-discovery";
import { SYSTEM as SYNTHESIS_SYSTEM } from "@/services/intelligence/deep-discovery/synthesize-findings";
import type { EnrichedCandidate } from "@/services/intelligence/discovery/enrich-candidate";

function baseCandidate(overrides: Partial<EnrichedCandidate> = {}): EnrichedCandidate {
  return {
    url: "https://roui.dev",
    canonicalUrl: "https://roui.dev",
    title: "RoUI",
    snippet: "Roblox UI toolkit",
    platform: "other",
    sourceType: "competitor_homepage",
    adapter: "exa+brave",
    discoveryQuery: "roblox ui tool",
    discoveryReason: "Find competitors",
    relevanceScore: 0.8,
    accountHandle: null,
    enrichStatus: "deep_enriched",
    enrichError: null,
    enrichedTitle: "RoUI — UI for Roblox",
    enrichedSnippet: "Build Roblox interfaces faster.",
    fetchMetadata: { fetch_status: "success" },
    deepEnrichment: null,
    ...overrides,
  };
}

describe("deep-discovery.buildEnrichedDigest", () => {
  it("returns empty string when no candidates", () => {
    expect(buildEnrichedDigest([])).toBe("");
  });

  it("includes title, URL and snippet for plain enriched candidates", () => {
    const digest = buildEnrichedDigest([
      baseCandidate({ enrichStatus: "enriched", deepEnrichment: null }),
    ]);
    expect(digest).toContain("RoUI");
    expect(digest).toContain("https://roui.dev");
    expect(digest).toContain("Build Roblox interfaces faster.");
    expect(digest).toContain("(fetched)");
    expect(digest).not.toContain("(deep_enriched)");
  });

  it("labels deep-enriched sources as (deep_enriched) not (fetched)", () => {
    const digest = buildEnrichedDigest([
      baseCandidate({
        enrichStatus: "deep_enriched",
        deepEnrichment: {
          status: "enriched",
          error: null,
          baseUrl: "https://roui.dev",
          crawledAt: new Date().toISOString(),
          pages: [],
          consolidated: { positioning: "Roblox UI toolkit" },
        },
      }),
    ]);
    expect(digest).toContain("(deep_enriched)");
    expect(digest).not.toMatch(/\(fetched\).*positioning:/s);
  });

  it("includes deep_enrichment consolidated fields when present", () => {
    const digest = buildEnrichedDigest([
      baseCandidate({
        enrichStatus: "deep_enriched",
        deepEnrichment: {
          status: "enriched",
          error: null,
          baseUrl: "https://roui.dev",
          crawledAt: new Date().toISOString(),
          pages: [
            {
              url: "https://roui.dev",
              pageType: "homepage",
              status: "success",
              title: "RoUI",
              headings: [],
              ctas: [],
              bodyTextPreview: "(should not appear in digest)",
              extracted: null,
            },
            {
              url: "https://roui.dev/pricing",
              pageType: "pricing",
              status: "success",
              title: "Pricing",
              headings: [],
              ctas: [],
              bodyTextPreview: "(should not appear in digest)",
              extracted: null,
            },
          ],
          consolidated: {
            positioning: "The Roblox UI toolkit for solo developers",
            pricingSignal: "$19/mo",
            ctaPattern: "start free trial",
            keyFeatures: ["Themes", "Templates", "Export-ready assets", "Extra"],
            keyBenefits: ["Faster shipping", "Less rework"],
            contentThemes: ["product-led", "developer-focused"],
            repeatedTerms: ["roblox", "ui", "toolkit", "themes", "developers", "extra"],
            socialLinks: ["https://x.com/roui", "https://youtube.com/@roui"],
          },
        },
      }),
    ]);

    expect(digest).toContain("positioning: The Roblox UI toolkit");
    expect(digest).toContain("pricing: $19/mo");
    expect(digest).toContain("cta: start free trial");
    expect(digest).toContain("features:");
    expect(digest).toContain("benefits:");
    expect(digest).toContain("themes: product-led, developer-focused");
    expect(digest).toContain("terms:");
    expect(digest).toContain("social:");
    expect(digest).toContain("(homepage)https://roui.dev");
    expect(digest).toContain("(pricing)https://roui.dev/pricing");
  });

  it("limits features to top 3 and terms to top 5", () => {
    const digest = buildEnrichedDigest([
      baseCandidate({
        deepEnrichment: {
          status: "enriched",
          error: null,
          baseUrl: "https://roui.dev",
          crawledAt: new Date().toISOString(),
          pages: [],
          consolidated: {
            keyFeatures: ["F1", "F2", "F3", "F4", "F5"],
            repeatedTerms: ["t1", "t2", "t3", "t4", "t5", "t6", "t7"],
          },
        },
      }),
    ]);
    expect(digest).toMatch(/features: F1; F2; F3$/m);
    expect(digest).not.toContain("F4");
    expect(digest).toMatch(/terms: t1, t2, t3, t4, t5$/m);
    expect(digest).not.toContain("t6");
  });

  it("does not include raw body text from crawled pages", () => {
    const longBody = "BODY_TEXT_MARKER_" + "x".repeat(2000);
    const digest = buildEnrichedDigest([
      baseCandidate({
        deepEnrichment: {
          status: "enriched",
          error: null,
          baseUrl: "https://roui.dev",
          crawledAt: new Date().toISOString(),
          pages: [
            {
              url: "https://roui.dev/pricing",
              pageType: "pricing",
              status: "success",
              title: "Pricing",
              headings: [],
              ctas: [],
              bodyTextPreview: longBody,
              extracted: null,
            },
          ],
          consolidated: { positioning: "Short positioning text" },
        },
      }),
    ]);

    expect(digest).not.toContain("BODY_TEXT_MARKER_");
    expect(digest.length).toBeLessThan(2000);
  });

  it("skips deep enrichment block when status is not deep_enriched", () => {
    const digest = buildEnrichedDigest([
      baseCandidate({
        enrichStatus: "enriched",
        deepEnrichment: {
          status: "enriched",
          error: null,
          baseUrl: "https://roui.dev",
          crawledAt: new Date().toISOString(),
          pages: [],
          consolidated: { positioning: "Should not appear" },
        },
      }),
    ]);
    expect(digest).not.toContain("Should not appear");
    expect(digest).not.toContain("positioning:");
  });
});

describe("deep-discovery.synthesisPrompt", () => {
  it("references deep enrichment evidence types", () => {
    expect(SYNTHESIS_SYSTEM).toMatch(/deep enrichment/i);
    expect(SYNTHESIS_SYSTEM).toMatch(/positioning/i);
    expect(SYNTHESIS_SYSTEM).toMatch(/pricing/i);
    expect(SYNTHESIS_SYSTEM).toMatch(/cta/i);
  });

  it("forbids hallucinated pricing/CTAs/features", () => {
    expect(SYNTHESIS_SYSTEM).toMatch(/Pricing.*CTAs.*features.*ONLY/i);
    expect(SYNTHESIS_SYSTEM).toMatch(/hallucinate/i);
  });

  it("does not instruct the model to create experiments or posts", () => {
    expect(SYNTHESIS_SYSTEM).not.toMatch(/\bexperiment(s)?\b.*create/i);
    expect(SYNTHESIS_SYSTEM).not.toMatch(/generate.*post/i);
    expect(SYNTHESIS_SYSTEM).toMatch(/Do NOT propose content experiments/i);
  });

  it("restricts evidence_urls to discovered/crawled sources", () => {
    expect(SYNTHESIS_SYSTEM).toMatch(/evidence_urls.*ONLY from the gathered sources/i);
    expect(SYNTHESIS_SYSTEM).toMatch(/Do not invent URLs/i);
  });
});
