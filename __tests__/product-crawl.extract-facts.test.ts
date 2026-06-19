import { describe, it, expect } from "vitest";
import {
  extractFactsFromPage,
  extractFactsFromPages,
} from "@/services/intelligence/product-crawl/extract-facts";
import type { CrawledPageContent } from "@/services/intelligence/types";

function mockPage(overrides: Partial<CrawledPageContent> = {}): CrawledPageContent {
  return {
    url: "https://example.com/pricing",
    finalUrl: "https://example.com/pricing",
    title: "Pricing",
    description: "Plans and pricing",
    headings: ["Starter plan", "Enterprise"],
    ctas: ["Start free trial", "Start free trial"],
    bodyText: "Starter plan from $29/month. Enterprise pricing available.",
    markdown: "# Pricing",
    html: "<html></html>",
    adapterUsed: "crawl4ai",
    fetchStatus: "success",
    error: null,
    ...overrides,
  };
}

describe("product-crawl.extract-facts", () => {
  it("extracts pricing facts", () => {
    const facts = extractFactsFromPage(mockPage(), "pricing");
    expect(facts.some((f) => f.factType === "pricing" && /\$29/.test(f.factValue))).toBe(true);
  });

  it("extracts CTA facts", () => {
    const facts = extractFactsFromPage(mockPage(), "pricing");
    expect(facts.some((f) => f.factType === "cta" && f.factValue === "Start free trial")).toBe(true);
  });

  it("removes duplicate facts", () => {
    const facts = extractFactsFromPages([
      { page: mockPage(), pageType: "pricing" },
      { page: mockPage(), pageType: "pricing" },
    ]);
    const ctaFacts = facts.filter((f) => f.factType === "cta" && f.factValue === "Start free trial");
    expect(ctaFacts.length).toBe(1);
  });
});
