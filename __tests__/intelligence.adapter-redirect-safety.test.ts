import { afterEach, describe, it, expect, vi } from "vitest";

describe("intelligence.adapter-redirect-safety", () => {
  afterEach(() => {
    delete process.env.CRAWL4AI_API_URL;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("external crawl4ai rejects unsafe payload.url", async () => {
    process.env.CRAWL4AI_API_URL = "https://crawl4ai.local/scrape";
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: true,
        json: async () => ({
          url: "http://127.0.0.1/private",
          markdown: "secret content that should never be stored",
        }),
      }))
    );

    const { crawl4aiAdapter } = await import("@/services/intelligence/adapters/crawl4ai-adapter");
    const result = await crawl4aiAdapter.crawlPage({ url: "https://example.com/" });

    expect(result.fetchStatus).toBe("failed");
    expect(result.error).toContain("SSRF prevention");
  });
});
