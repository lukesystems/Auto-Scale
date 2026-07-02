import { describe, it, expect } from "vitest";
import {
  shouldDeepEnrich,
  discoverCompetitorPages,
  inferPageTypeFromUrl,
  extractPricingSignal,
  extractCtaPattern,
  extractSocialLinks,
  consolidateIntelligence,
  type CompetitorPageEnrichment,
} from "@/services/intelligence/enrichment/deep-enrich-source";
import {
  pickDeepEnrichCandidateIndices,
  MAX_DEEP_ENRICH_PER_RUN,
} from "@/services/intelligence/discovery/enrich-candidate";
import type { NormalizedCandidate } from "@/services/intelligence/discovery/dedupe-candidates";

describe("deep-enrichment.shouldDeepEnrich", () => {
  it("returns true for competitor homepages with high relevance", () => {
    expect(shouldDeepEnrich("competitor_homepage", 0.7)).toBe(true);
    expect(shouldDeepEnrich("competitor_pricing", 0.6)).toBe(true);
  });

  it("returns false for low relevance scores", () => {
    expect(shouldDeepEnrich("competitor_homepage", 0.5)).toBe(false);
    expect(shouldDeepEnrich("competitor_homepage", 0.3)).toBe(false);
  });

  it("returns false for non-competitor source types", () => {
    expect(shouldDeepEnrich("community_pain", 0.8)).toBe(false);
    expect(shouldDeepEnrich("video", 0.9)).toBe(false);
    expect(shouldDeepEnrich("unknown", 0.8)).toBe(false);
  });

  it("returns true for marketplace and documentation types", () => {
    expect(shouldDeepEnrich("marketplace", 0.6)).toBe(true);
    expect(shouldDeepEnrich("documentation", 0.7)).toBe(true);
  });
});

describe("deep-enrichment.discoverCompetitorPages", () => {
  it("discovers high-value paths from a base URL including homepage", () => {
    const pages = discoverCompetitorPages("https://roui.dev");

    const urls = pages.map((p) => p.url);
    // First page is always homepage
    expect(urls[0]).toBe("https://roui.dev");
    // Then high-value paths: pricing, plans, features, product (up to 4 total)
    expect(urls).toContain("https://roui.dev/pricing");
    expect(urls).toContain("https://roui.dev/features");
    expect(urls.length).toBeLessThanOrEqual(4);
  });

  it("includes homepage first and dedupes base URL from subpaths", () => {
    const pages = discoverCompetitorPages("https://example.com/");

    const urls = pages.map((p) => p.url);
    // Homepage is always included first
    expect(urls[0]).toBe("https://example.com/");
    // Subpaths that equal base URL are deduped
    const baseCanonicalCount = urls.filter(
      (u) => u === "https://example.com/" || u === "https://example.com"
    ).length;
    expect(baseCanonicalCount).toBe(1);
  });

  it("returns empty array for invalid URLs", () => {
    expect(discoverCompetitorPages("not-a-url")).toEqual([]);
  });

  it("limits to max pages", () => {
    const pages = discoverCompetitorPages("https://example.com");
    expect(pages.length).toBeLessThanOrEqual(4);
  });
});

describe("deep-enrichment.inferPageTypeFromUrl", () => {
  it("detects pricing pages", () => {
    expect(inferPageTypeFromUrl("https://acme.com/pricing")).toBe("pricing");
    expect(inferPageTypeFromUrl("https://acme.com/plans")).toBe("pricing");
  });

  it("detects feature pages", () => {
    expect(inferPageTypeFromUrl("https://acme.com/features")).toBe("features");
    expect(inferPageTypeFromUrl("https://acme.com/product")).toBe("product");
  });

  it("detects about and blog pages", () => {
    expect(inferPageTypeFromUrl("https://acme.com/about")).toBe("about");
    expect(inferPageTypeFromUrl("https://acme.com/blog")).toBe("blog");
  });

  it("defaults to other for unknown paths", () => {
    expect(inferPageTypeFromUrl("https://acme.com/random-page")).toBe("other");
  });
});

describe("deep-enrichment.extractPricingSignal", () => {
  it("extracts dollar amounts", () => {
    expect(extractPricingSignal("Starting at $19/month")).toMatch(/\$19/);
    expect(extractPricingSignal("$99/year for Pro")).toMatch(/\$99/);
  });

  it("extracts pricing keywords", () => {
    expect(extractPricingSignal("Free trial available")).toMatch(/free.*trial/i);
    expect(extractPricingSignal("Enterprise plan available")).toMatch(/enterprise.*plan/i);
  });

  it("returns undefined when no pricing signal found", () => {
    expect(extractPricingSignal("Welcome to our product")).toBeUndefined();
  });
});

describe("deep-enrichment.extractCtaPattern", () => {
  it("detects product-led CTAs", () => {
    const text = "Get started for free today";
    const headings: string[] = [];
    expect(extractCtaPattern(text, headings)).toMatch(/get started/i);
  });

  it("detects sales-led CTAs", () => {
    const text = "Contact sales for enterprise pricing";
    const headings: string[] = [];
    expect(extractCtaPattern(text, headings)).toMatch(/contact sales/i);
  });

  it("detects CTAs in headings", () => {
    const text = "";
    const headings = ["Start Your Free Trial", "Sign Up Now"];
    expect(extractCtaPattern(text, headings)).toMatch(/sign up/i);
  });

  it("returns undefined when no CTA found", () => {
    expect(extractCtaPattern("Just some information", [])).toBeUndefined();
  });
});

describe("deep-enrichment.extractSocialLinks", () => {
  it("extracts Twitter/X links", () => {
    const html = `
      <a href="https://twitter.com/acme">Twitter</a>
      <a href="https://x.com/acme">X</a>
    `;
    const links = extractSocialLinks(html);
    expect(links).toContain("https://twitter.com/acme");
    expect(links).toContain("https://x.com/acme");
  });

  it("extracts LinkedIn and YouTube links", () => {
    const html = `
      <a href="https://linkedin.com/company/acme">LinkedIn</a>
      <a href="https://youtube.com/c/acme">YouTube</a>
    `;
    const links = extractSocialLinks(html);
    expect(links).toContain("https://linkedin.com/company/acme");
    expect(links).toContain("https://youtube.com/c/acme");
  });

  it("handles HTML entities in URLs", () => {
    const html = '<a href="https://twitter.com/acme&amp;ref=footer">Twitter</a>';
    const links = extractSocialLinks(html);
    expect(links[0]).toBe("https://twitter.com/acme&ref=footer");
  });

  it("dedupes and limits social links", () => {
    const html = `
      <a href="https://twitter.com/acme">Twitter 1</a>
      <a href="https://twitter.com/acme">Twitter 2</a>
      <a href="https://linkedin.com/company/acme">LinkedIn</a>
    `;
    const links = extractSocialLinks(html);
    expect(links.filter((l) => l.includes("twitter")).length).toBe(1);
  });

  it("returns empty array for null HTML", () => {
    expect(extractSocialLinks(null)).toEqual([]);
  });
});

describe("deep-enrichment.consolidateIntelligence", () => {
  const mockPage = (
    overrides: Partial<CompetitorPageEnrichment> = {}
  ): CompetitorPageEnrichment => ({
    url: "https://example.com",
    pageType: "homepage",
    status: "success",
    title: "Example",
    headings: [],
    ctas: [],
    bodyTextPreview: "",
    extracted: {
      positioning: "A tool for developers",
      keyFeatures: ["Feature A", "Feature B"],
      keyBenefits: ["Benefit 1"],
      pricingSignal: "$19/mo",
      ctaPattern: "Start free trial",
      contentThemes: ["product-led"],
      socialLinks: ["https://twitter.com/example"],
      repeatedTerms: ["developer", "tool"],
    },
    ...overrides,
  });

  it("returns null when no successful pages", () => {
    const failed = mockPage({ status: "failed", error: "Timeout" });
    expect(consolidateIntelligence([failed])).toBeNull();
  });

  it("consolidates features and benefits from multiple pages", () => {
    const pages = [
      mockPage({
        extracted: {
          keyFeatures: ["Feature A", "Feature B"],
          keyBenefits: ["Benefit 1"],
        },
      }),
      mockPage({
        extracted: {
          keyFeatures: ["Feature C", "Feature A"],
          keyBenefits: ["Benefit 2"],
        },
      }),
    ];

    const result = consolidateIntelligence(pages);
    expect(result?.keyFeatures).toContain("Feature A");
    expect(result?.keyFeatures).toContain("Feature B");
    expect(result?.keyFeatures).toContain("Feature C");
    expect(result?.keyBenefits).toContain("Benefit 1");
    expect(result?.keyBenefits).toContain("Benefit 2");
  });

  it("dedupes content themes", () => {
    const pages = [
      mockPage({ extracted: { contentThemes: ["product-led", "developer-focused"] } }),
      mockPage({ extracted: { contentThemes: ["product-led", "social-proof"] } }),
    ];

    const result = consolidateIntelligence(pages);
    expect(result?.contentThemes?.filter((t) => t === "product-led").length).toBe(1);
    expect(result?.contentThemes).toContain("developer-focused");
    expect(result?.contentThemes).toContain("social-proof");
  });

  it("uses first pricing signal and CTA pattern", () => {
    const pages = [
      mockPage({ extracted: { pricingSignal: "$19/mo", ctaPattern: "Start free" } }),
      mockPage({ extracted: { pricingSignal: "$49/mo", ctaPattern: "Book demo" } }),
    ];

    const result = consolidateIntelligence(pages);
    expect(result?.pricingSignal).toBe("$19/mo");
    expect(result?.ctaPattern).toBe("Start free");
  });

  it("aggregates social links from all pages", () => {
    const pages = [
      mockPage({ extracted: { socialLinks: ["https://twitter.com/acme"] } }),
      mockPage({ extracted: { socialLinks: ["https://linkedin.com/company/acme"] } }),
    ];

    const result = consolidateIntelligence(pages);
    expect(result?.socialLinks).toContain("https://twitter.com/acme");
    expect(result?.socialLinks).toContain("https://linkedin.com/company/acme");
  });

  it("counts repeated terms across pages", () => {
    const pages = [
      mockPage({ extracted: { repeatedTerms: ["developer", "tool", "api"] } }),
      mockPage({ extracted: { repeatedTerms: ["developer", "platform"] } }),
    ];

    const result = consolidateIntelligence(pages);
    expect(result?.repeatedTerms).toContain("developer");
    expect(result?.repeatedTerms?.length).toBeLessThanOrEqual(10);
  });
});

function mockCandidate(
  overrides: Partial<NormalizedCandidate> & { url: string }
): NormalizedCandidate {
  return {
    canonicalUrl: overrides.canonicalUrl ?? overrides.url,
    title: overrides.title ?? "Example",
    snippet: overrides.snippet ?? null,
    platform: overrides.platform ?? "other",
    sourceType: overrides.sourceType ?? "competitor_homepage",
    adapter: overrides.adapter ?? "exa",
    discoveryQuery: overrides.discoveryQuery ?? "q",
    discoveryReason: overrides.discoveryReason ?? "r",
    relevanceScore: overrides.relevanceScore ?? 0.8,
    accountHandle: overrides.accountHandle ?? null,
    url: overrides.url,
  };
}

describe("enrichment.pickDeepEnrichCandidateIndices", () => {
  it("caps deep enrichment to MAX_DEEP_ENRICH_PER_RUN qualifying candidates", () => {
    const candidates = Array.from({ length: 12 }, (_, i) =>
      mockCandidate({
        url: `https://competitor-${i}.dev`,
        sourceType: "competitor_homepage",
        relevanceScore: 0.9 - i * 0.01,
      })
    );

    const indices = pickDeepEnrichCandidateIndices(candidates);
    expect(indices.size).toBe(MAX_DEEP_ENRICH_PER_RUN);
    expect(indices.has(0)).toBe(true);
    expect(indices.has(7)).toBe(true);
    expect(indices.has(8)).toBe(false);
  });

  it("skips candidates that do not qualify for deep enrichment", () => {
    const candidates = [
      mockCandidate({ url: "https://a.dev", sourceType: "community_pain", relevanceScore: 0.9 }),
      mockCandidate({ url: "https://b.dev", sourceType: "competitor_homepage", relevanceScore: 0.4 }),
      mockCandidate({ url: "https://c.dev", sourceType: "competitor_homepage", relevanceScore: 0.8 }),
    ];

    const indices = pickDeepEnrichCandidateIndices(candidates);
    expect(indices).toEqual(new Set([2]));
  });

  it("respects a custom max cap", () => {
    const candidates = Array.from({ length: 6 }, (_, i) =>
      mockCandidate({ url: `https://c${i}.dev`, relevanceScore: 0.8 })
    );

    expect(pickDeepEnrichCandidateIndices(candidates, 2).size).toBe(2);
  });
});
