import { describe, it, expect } from "vitest";
import { classifyPage } from "@/services/intelligence/product-crawl/classify-page";
import type { CrawledPageContent } from "@/services/intelligence/types";

function mockPage(overrides: Partial<CrawledPageContent> = {}): CrawledPageContent {
  return {
    url: "https://example.com/pricing",
    finalUrl: "https://example.com/pricing",
    title: "Pricing",
    description: "Plans and pricing",
    headings: ["Starter plan"],
    ctas: ["Start free trial"],
    bodyText: "Starter plan from $29/month.",
    markdown: "# Pricing",
    html: "<html><body><h1>Pricing</h1></body></html>",
    adapterUsed: "crawl4ai",
    fetchStatus: "success",
    error: null,
    ...overrides,
  };
}

describe("product-crawl.classify-page", () => {
  it("classifies pricing pages", () => {
    expect(classifyPage(mockPage())).toBe("pricing");
  });

  it("classifies features pages", () => {
    expect(
      classifyPage(
        mockPage({
          url: "https://example.com/features",
          finalUrl: "https://example.com/features",
          title: "Features",
        })
      )
    ).toBe("features");
  });

  it("classifies homepage when flagged", () => {
    const home = mockPage({ url: "https://example.com/", finalUrl: "https://example.com/" });
    expect(classifyPage(home, true)).toBe("home");
  });
});
