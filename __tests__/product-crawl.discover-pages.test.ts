import { describe, it, expect } from "vitest";
import { crawl4aiAdapter } from "@/services/intelligence/adapters/crawl4ai-adapter";
import { discoverPages, prioritizePageUrls } from "@/services/intelligence/product-crawl/discover-pages";

describe("product-crawl.discover-pages", () => {
  it("dedupes internal links and ignores external links", async () => {
    const html = `
      <html><body>
        <a href="/pricing">Pricing</a>
        <a href="/pricing">Plans</a>
        <a href="https://evil.example/features">External features</a>
        <a href="/features">Features</a>
      </body></html>
    `;

    const discovered = await crawl4aiAdapter.discoverLinks!("https://example.com/", html);
    const urls = discovered.map((link) => link.url);

    expect(urls.every((url) => url.startsWith("https://example.com"))).toBe(true);
    expect(urls.some((url) => url.includes("evil.example"))).toBe(false);
    expect(urls.filter((url) => url.includes("/pricing")).length).toBe(1);
  });

  it("prioritizes homepage first", () => {
    const urls = prioritizePageUrls(
      "https://example.com/",
      [
        { url: "https://example.com/pricing", anchorText: "pricing", path: "/pricing", score: 10 },
        { url: "https://example.com/features", anchorText: "features", path: "/features", score: 6 },
      ],
      5
    );

    expect(urls[0]).toBe("https://example.com/");
  });

  it("filters low-score links in discoverPages", async () => {
    const html = `<html><body><a href="/random-page">Random</a></body></html>`;
    const discovered = await discoverPages({
      homepageUrl: "https://example.com/",
      homepageHtml: html,
      maxPages: 10,
    });

    expect(discovered.length).toBe(0);
  });
});
