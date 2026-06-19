import { describe, it, expect } from "vitest";
import { classifyPage } from "../services/intelligence/product-crawl/classify-page";
import { extractFactsFromPage } from "../services/intelligence/product-crawl/extract-facts";
import { prioritizePageUrls } from "../services/intelligence/product-crawl/discover-pages";
import { htmlToMarkdown, needsBrowserRender } from "../services/intelligence/adapters/html-utils";
import type { CrawledPageContent } from "../services/intelligence/types";

function mockPage(overrides: Partial<CrawledPageContent> = {}): CrawledPageContent {
  return {
    url: "https://example.com/pricing",
    finalUrl: "https://example.com/pricing",
    title: "Pricing",
    description: "Plans and pricing",
    headings: ["Starter plan", "Enterprise"],
    ctas: ["Start free trial"],
    bodyText: "Starter plan from $29/month. Enterprise pricing available.",
    markdown: "# Pricing\n\nStarter plan from $29/month.",
    html: "<html><body><h1>Pricing</h1></body></html>",
    adapterUsed: "crawl4ai",
    fetchStatus: "success",
    error: null,
    ...overrides,
  };
}

describe("Product Site Intelligence", () => {
  describe("classifyPage", () => {
    it("classifies pricing pages", () => {
      expect(classifyPage(mockPage())).toBe("pricing");
    });

    it("classifies homepage", () => {
      const home = mockPage({ url: "https://example.com/", finalUrl: "https://example.com/" });
      expect(classifyPage(home, true)).toBe("home");
    });
  });

  describe("extractFactsFromPage", () => {
    it("extracts pricing and CTA facts", () => {
      const facts = extractFactsFromPage(mockPage(), "pricing");
      expect(facts.some((f) => f.factType === "pricing")).toBe(true);
      expect(facts.some((f) => f.factType === "cta" && f.factValue === "Start free trial")).toBe(true);
    });
  });

  describe("prioritizePageUrls", () => {
    it("puts homepage first and dedupes", () => {
      const urls = prioritizePageUrls(
        "https://example.com/",
        [
          { url: "https://example.com/pricing", anchorText: "pricing", path: "/pricing", score: 10 },
          { url: "https://example.com/pricing", anchorText: "plans", path: "/pricing", score: 8 },
          { url: "https://example.com/features", anchorText: "features", path: "/features", score: 6 },
        ],
        5
      );

      expect(urls[0]).toBe("https://example.com/");
      expect(urls.filter((u) => u.includes("/pricing")).length).toBe(1);
    });
  });

  describe("htmlToMarkdown", () => {
    it("converts headings and list items", () => {
      const md = htmlToMarkdown(`
        <html><body>
          <h1>Product</h1>
          <ul><li>Fast setup</li><li>AI powered</li></ul>
          <p>Built for founders.</p>
        </body></html>
      `);
      expect(md).toContain("# Product");
      expect(md).toContain("- Fast setup");
      expect(md).toContain("Built for founders.");
    });
  });

  describe("needsBrowserRender", () => {
    it("detects SPA shells with little text", () => {
      const html = '<html><body><div id="root"></div><script>window.__NEXT_DATA__={}</script></body></html>';
      expect(needsBrowserRender(html, "loading")).toBe(true);
      expect(needsBrowserRender(html, "x".repeat(500))).toBe(false);
    });
  });
});
