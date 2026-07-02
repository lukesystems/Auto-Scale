import { afterEach, describe, it, expect, vi } from "vitest";
import { extractPage } from "@/services/intelligence/product-crawl/extract-page";
import { playwrightAdapter } from "@/services/intelligence/adapters/playwright-adapter";
import { firecrawlCrawlAdapter } from "@/services/intelligence/adapters/firecrawl-adapter";
import { crawl4aiAdapter } from "@/services/intelligence/adapters/crawl4ai-adapter";

describe("product-crawl.extract-page", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    delete process.env.PLAYWRIGHT_ENABLED;
    delete process.env.FIRECRAWL_API_KEY;
  });

  it("rejects unsafe URLs before any adapter runs", async () => {
    const crawlSpy = vi.spyOn(crawl4aiAdapter, "crawlPage");
    const playwrightSpy = vi.spyOn(playwrightAdapter, "crawlPage");

    const result = await extractPage({ url: "http://127.0.0.1/private" });

    expect(result.fetchStatus).toBe("failed");
    expect(result.error).toContain("SSRF prevention");
    expect(crawlSpy).not.toHaveBeenCalled();
    expect(playwrightSpy).not.toHaveBeenCalled();
  });

  it("does not run Playwright fallback unless enabled", async () => {
    delete process.env.PLAYWRIGHT_ENABLED;

    vi.spyOn(crawl4aiAdapter, "crawlPage").mockResolvedValue({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: null,
      description: null,
      headings: [],
      ctas: [],
      bodyText: "loading",
      markdown: "",
      html: '<html><body><div id="root"></div><script>window.__NEXT_DATA__={}</script></body></html>',
      adapterUsed: "crawl4ai",
      fetchStatus: "success",
      error: null,
    });

    const playwrightSpy = vi.spyOn(playwrightAdapter, "crawlPage");

    await extractPage({ url: "https://example.com/" });

    expect(playwrightSpy).not.toHaveBeenCalled();
  });

  it("can use Playwright fallback when enabled and primary content is thin", async () => {
    process.env.PLAYWRIGHT_ENABLED = "1";

    vi.spyOn(crawl4aiAdapter, "crawlPage").mockResolvedValue({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: null,
      description: null,
      headings: [],
      ctas: [],
      bodyText: "loading",
      markdown: "",
      html: '<html><body><div id="root"></div><script>window.__NEXT_DATA__={}</script></body></html>',
      adapterUsed: "crawl4ai",
      fetchStatus: "success",
      error: null,
    });

    vi.spyOn(playwrightAdapter, "crawlPage").mockResolvedValue({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: "Example Product",
      description: "A real product page",
      headings: ["Features"],
      ctas: ["Get started"],
      bodyText: "x".repeat(400),
      markdown: "# Example Product",
      html: "<html><body><h1>Example Product</h1></body></html>",
      adapterUsed: "playwright",
      fetchStatus: "success",
      error: null,
    });

    const result = await extractPage({ url: "https://example.com/" });

    expect(result.adapterUsed).toBe("playwright");
    expect(result.bodyText.length).toBeGreaterThan(300);
  });

  it("autobrief profile uses Firecrawl instead of Playwright for thin JS shells", async () => {
    process.env.PLAYWRIGHT_ENABLED = "1";
    process.env.FIRECRAWL_API_KEY = "fc-test-key";

    vi.spyOn(crawl4aiAdapter, "crawlPage").mockResolvedValue({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: null,
      description: null,
      headings: [],
      ctas: [],
      bodyText: "loading",
      markdown: "",
      html: '<html><body><div id="root"></div><script>window.__NEXT_DATA__={}</script></body></html>',
      adapterUsed: "crawl4ai",
      fetchStatus: "success",
      error: null,
    });

    const playwrightSpy = vi.spyOn(playwrightAdapter, "crawlPage");
    vi.spyOn(firecrawlCrawlAdapter, "isAvailable").mockReturnValue(true);
    vi.spyOn(firecrawlCrawlAdapter, "crawlPage").mockResolvedValue({
      url: "https://example.com/",
      finalUrl: "https://example.com/",
      title: "Example Product",
      description: "From Firecrawl",
      headings: ["Features"],
      ctas: ["Get started"],
      bodyText: "x".repeat(400),
      markdown: "# Example Product",
      html: "<html><body><h1>Example Product</h1></body></html>",
      adapterUsed: "firecrawl",
      fetchStatus: "success",
      error: null,
    });

    const result = await extractPage({ url: "https://example.com/", scrapeProfile: "autobrief" });

    expect(playwrightSpy).not.toHaveBeenCalled();
    expect(result.adapterUsed).toBe("firecrawl");
    expect(result.bodyText.length).toBeGreaterThan(300);
  });

  it("autobrief profile tries Firecrawl immediately when direct fetch fails", async () => {
    process.env.FIRECRAWL_API_KEY = "fc-test-key";

    vi.spyOn(crawl4aiAdapter, "crawlPage").mockResolvedValue({
      url: "https://blocked.com/",
      finalUrl: "https://blocked.com/",
      title: null,
      description: null,
      headings: [],
      ctas: [],
      bodyText: "",
      markdown: "",
      html: null,
      adapterUsed: "crawl4ai",
      fetchStatus: "failed",
      error: "HTTP error 429: Too Many Requests",
    });

    const firecrawlSpy = vi.spyOn(firecrawlCrawlAdapter, "isAvailable").mockReturnValue(true);
    vi.spyOn(firecrawlCrawlAdapter, "crawlPage").mockResolvedValue({
      url: "https://blocked.com/",
      finalUrl: "https://blocked.com/",
      title: "Blocked Site",
      description: null,
      headings: [],
      ctas: [],
      bodyText: "Recovered marketing copy from Firecrawl.",
      markdown: "# Blocked Site",
      html: "<html><body><h1>Blocked Site</h1></body></html>",
      adapterUsed: "firecrawl",
      fetchStatus: "success",
      error: null,
    });

    const result = await extractPage({ url: "https://blocked.com/", scrapeProfile: "autobrief" });

    expect(firecrawlSpy).toHaveBeenCalled();
    expect(result.adapterUsed).toBe("firecrawl");
  });
});
