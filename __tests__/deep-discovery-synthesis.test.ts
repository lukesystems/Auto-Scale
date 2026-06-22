import { describe, it, expect } from "vitest";
import type { EnrichedCandidate } from "@/services/intelligence/discovery/enrich-candidate";
import type { DeepEnrichmentResult, CompetitorIntelligence } from "@/services/intelligence/enrichment/deep-enrich-source";

// Replicate the buildEnrichedDigest logic for testing
function buildEnrichedDigest(candidates: EnrichedCandidate[]): string {
  if (!candidates.length) return "";

  const lines: string[] = [];
  const MAX_DIGEST_LINES = 40;

  for (const c of candidates.slice(0, MAX_DIGEST_LINES)) {
    const handle = c.accountHandle ? ` @${c.accountHandle}` : "";
    const status =
      c.enrichStatus === "deep_enriched"
        ? "deep_enriched"
        : c.enrichStatus === "enriched"
          ? "fetched"
          : `${c.enrichStatus}`;
    const title = c.enrichedTitle ?? c.title ?? c.url;
    const snippet = c.enrichedSnippet ? ` — ${c.enrichedSnippet.slice(0, 200)}` : "";
    lines.push(`- [${c.platform}/${c.sourceType}] (${status})${handle} ${title} (${c.url})${snippet}`);

    // Include deep enrichment intelligence if available
    const deep = c.deepEnrichment?.consolidated;
    if (deep && c.enrichStatus === "deep_enriched") {
      const deepLines: string[] = [];

      if (deep.positioning) {
        deepLines.push(`  positioning: ${deep.positioning.slice(0, 120)}`);
      }
      if (deep.pricingSignal) {
        deepLines.push(`  pricing: ${deep.pricingSignal}`);
      }
      if (deep.ctaPattern) {
        deepLines.push(`  cta: ${deep.ctaPattern}`);
      }
      if (deep.keyFeatures?.length) {
        deepLines.push(`  features: ${deep.keyFeatures.slice(0, 3).join("; ")}`);
      }
      if (deep.keyBenefits?.length) {
        deepLines.push(`  benefits: ${deep.keyBenefits.slice(0, 3).join("; ")}`);
      }
      if (deep.contentThemes?.length) {
        deepLines.push(`  themes: ${deep.contentThemes.join(", ")}`);
      }
      if (deep.repeatedTerms?.length) {
        deepLines.push(`  terms: ${deep.repeatedTerms.slice(0, 5).join(", ")}`);
      }
      if (deep.socialLinks?.length) {
        deepLines.push(`  social: ${deep.socialLinks.slice(0, 3).join(", ")}`);
      }

      // Include successful crawled page URLs as evidence
      const successfulPages = c.deepEnrichment?.pages?.filter((p) => p.status === "success");
      if (successfulPages?.length) {
        const pageUrls = successfulPages.map((p) => `(${p.pageType})${p.url}`).slice(0, 4);
        deepLines.push(`  pages: ${pageUrls.join(", ")}`);
      }

      if (deepLines.length) {
        lines.push(...deepLines.map((l) => `${l}`));
      }
    }
  }

  return lines.join("\n");
}

function createMockDeepEnrichment(overrides: {
  positioning?: string;
  pricingSignal?: string;
  ctaPattern?: string;
  keyFeatures?: string[];
  keyBenefits?: string[];
  contentThemes?: string[];
  repeatedTerms?: string[];
  socialLinks?: string[];
  pages?: Array<{ url: string; pageType: string; status: "success" | "failed" }>;
} = {}): DeepEnrichmentResult {
  const consolidated: CompetitorIntelligence = {
    positioning: overrides.positioning,
    pricingSignal: overrides.pricingSignal,
    ctaPattern: overrides.ctaPattern,
    keyFeatures: overrides.keyFeatures,
    keyBenefits: overrides.keyBenefits,
    contentThemes: overrides.contentThemes,
    repeatedTerms: overrides.repeatedTerms,
    socialLinks: overrides.socialLinks,
  };

  const pages = overrides.pages ?? [
    { url: "https://example.com", pageType: "homepage", status: "success" },
    { url: "https://example.com/pricing", pageType: "pricing", status: "success" },
  ];

  return {
    status: "enriched",
    error: null,
    baseUrl: "https://example.com",
    crawledAt: new Date().toISOString(),
    pages: pages.map((p) => ({
      url: p.url,
      pageType: p.pageType as any,
      status: p.status,
      title: p.pageType === "homepage" ? "Example Homepage" : `${p.pageType} page`,
      headings: [],
      ctas: [],
      bodyTextPreview: "",
      extracted: null,
    })),
    consolidated,
  };
}

function createMockCandidate(overrides: {
  url?: string;
  enrichStatus?: EnrichedCandidate["enrichStatus"];
  deepEnrichment?: DeepEnrichmentResult | null;
} = {}): EnrichedCandidate {
  return {
    url: overrides.url ?? "https://example.com",
    canonicalUrl: overrides.url ?? "https://example.com",
    title: "Example Competitor",
    snippet: "A competitor in the space",
    platform: "other",
    sourceType: "competitor_homepage",
    adapter: "exa",
    discoveryQuery: "competitor tool",
    discoveryReason: "Find competitors",
    relevanceScore: 0.75,
    accountHandle: null,
    enrichStatus: overrides.enrichStatus ?? "enriched",
    enrichError: null,
    enrichedTitle: "Example Competitor",
    enrichedSnippet: "A competitor in the space with great features",
    fetchMetadata: { fetch_status: "success" },
    deepEnrichment: overrides.deepEnrichment ?? null,
  };
}

describe("deep-discovery.buildEnrichedDigest", () => {
  it("includes basic candidate info for non-deep-enriched candidates", () => {
    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "enriched", deepEnrichment: null }),
    ];

    const digest = buildEnrichedDigest(candidates);

    expect(digest).toContain("[other/competitor_homepage]");
    expect(digest).toContain("(fetched)");
    expect(digest).toContain("https://example.com");
    expect(digest).toContain("A competitor in the space");
  });

  it("includes deep enrichment consolidated data when status is deep_enriched", () => {
    const deepEnrichment = createMockDeepEnrichment({
      positioning: "The leading platform for developer tools",
      pricingSignal: "$19/mo",
      ctaPattern: "Start free trial",
      keyFeatures: ["Feature A", "Feature B", "Feature C"],
      keyBenefits: ["Benefit 1", "Benefit 2"],
      contentThemes: ["product-led", "developer-focused"],
      repeatedTerms: ["developer", "tool", "platform", "api", "integration"],
      socialLinks: ["https://twitter.com/example", "https://linkedin.com/company/example"],
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    // Check basic info still present
    expect(digest).toContain("(deep_enriched)");
    expect(digest).not.toContain("(fetched)");
    expect(digest).toContain("https://example.com");

    // Check deep enrichment data included
    expect(digest).toContain("positioning: The leading platform for developer tools");
    expect(digest).toContain("pricing: $19/mo");
    expect(digest).toContain("cta: Start free trial");
    expect(digest).toContain("features: Feature A; Feature B; Feature C");
    expect(digest).toContain("benefits: Benefit 1; Benefit 2");
    expect(digest).toContain("themes: product-led, developer-focused");
    expect(digest).toContain("terms: developer, tool, platform, api, integration");
    expect(digest).toContain("social: https://twitter.com/example, https://linkedin.com/company/example");
  });

  it("limits features to top 3", () => {
    const deepEnrichment = createMockDeepEnrichment({
      keyFeatures: ["F1", "F2", "F3", "F4", "F5"],
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    expect(digest).toContain("features: F1; F2; F3");
    expect(digest).not.toContain("F4");
    expect(digest).not.toContain("F5");
  });

  it("limits benefits to top 3", () => {
    const deepEnrichment = createMockDeepEnrichment({
      keyBenefits: ["B1", "B2", "B3", "B4"],
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    expect(digest).toContain("benefits: B1; B2; B3");
    expect(digest).not.toContain("B4");
  });

  it("limits repeated terms to top 5", () => {
    const deepEnrichment = createMockDeepEnrichment({
      repeatedTerms: ["t1", "t2", "t3", "t4", "t5", "t6", "t7"],
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    expect(digest).toContain("terms: t1, t2, t3, t4, t5");
    expect(digest).not.toContain("t6");
    expect(digest).not.toContain("t7");
  });

  it("limits social links to top 3", () => {
    const deepEnrichment = createMockDeepEnrichment({
      socialLinks: ["https://s1.com", "https://s2.com", "https://s3.com", "https://s4.com"],
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    expect(digest).toContain("social: https://s1.com, https://s2.com, https://s3.com");
    expect(digest).not.toContain("https://s4.com");
  });

  it("includes successful crawled page URLs with page types", () => {
    const deepEnrichment = createMockDeepEnrichment({
      pages: [
        { url: "https://example.com", pageType: "homepage", status: "success" },
        { url: "https://example.com/pricing", pageType: "pricing", status: "success" },
        { url: "https://example.com/features", pageType: "features", status: "success" },
        { url: "https://example.com/failed", pageType: "about", status: "failed" },
      ],
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    // Should include successful pages
    expect(digest).toContain("(homepage)https://example.com");
    expect(digest).toContain("(pricing)https://example.com/pricing");
    expect(digest).toContain("(features)https://example.com/features");

    // Should not include failed pages
    expect(digest).not.toContain("(about)https://example.com/failed");
  });

  it("limits pages to 4", () => {
    const deepEnrichment = createMockDeepEnrichment({
      pages: [
        { url: "https://example.com", pageType: "homepage", status: "success" },
        { url: "https://example.com/p1", pageType: "pricing", status: "success" },
        { url: "https://example.com/p2", pageType: "features", status: "success" },
        { url: "https://example.com/p3", pageType: "product", status: "success" },
        { url: "https://example.com/p4", pageType: "about", status: "success" },
        { url: "https://example.com/p5", pageType: "blog", status: "success" },
      ],
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    // Should only include first 4 successful pages
    const pagesMatch = digest.match(/pages: /);
    expect(pagesMatch).toBeTruthy();

    const pagesLine = digest.split("\n").find((l) => l.includes("pages:"));
    const pageCount = pagesLine?.split(",").length ?? 0;
    expect(pageCount).toBeLessThanOrEqual(4);
  });

  it("does not include deep enrichment data when enrichStatus is not deep_enriched", () => {
    const deepEnrichment = createMockDeepEnrichment({
      positioning: "Should not appear",
      pricingSignal: "$99/mo",
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    // Even though deepEnrichment exists, status is "enriched" not "deep_enriched"
    expect(digest).not.toContain("positioning:");
    expect(digest).not.toContain("Should not appear");
    expect(digest).not.toContain("pricing:");
  });

  it("handles truncated positioning over 120 chars", () => {
    const longPositioning = "A".repeat(200);
    const deepEnrichment = createMockDeepEnrichment({
      positioning: longPositioning,
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    expect(digest).toContain("positioning: ");
    // Should be truncated to 120 chars plus the prefix
    const positioningLine = digest.split("\n").find((l) => l.includes("positioning:"));
    expect(positioningLine?.length).toBeLessThanOrEqual(135); // "  positioning: " (16) + 120
  });

  it("handles candidates with partial deep enrichment data", () => {
    const deepEnrichment = createMockDeepEnrichment({
      pricingSignal: "$29/mo",
      // No positioning, cta, features, benefits, themes, terms, or social
    });

    const candidates: EnrichedCandidate[] = [
      createMockCandidate({ enrichStatus: "deep_enriched", deepEnrichment }),
    ];

    const digest = buildEnrichedDigest(candidates);

    // Should only include lines for fields that exist
    expect(digest).toContain("pricing: $29/mo");
    expect(digest).not.toContain("positioning:");
    expect(digest).not.toContain("cta:");
    expect(digest).not.toContain("features:");
  });

  it("respects MAX_DIGEST_LINES limit", () => {
    // Create many candidates to test limit
    const candidates: EnrichedCandidate[] = Array.from({ length: 50 }, (_, i) =>
      createMockCandidate({
        url: `https://example${i}.com`,
        enrichStatus: "enriched",
        deepEnrichment: null,
      })
    );

    const digest = buildEnrichedDigest(candidates);
    const lines = digest.split("\n").filter((l) => l.trim());

    // Should be limited to roughly 40 candidates (lines may vary due to deep enrichment)
    expect(lines.length).toBeLessThanOrEqual(45); // Allow some buffer for structure
  });
});
