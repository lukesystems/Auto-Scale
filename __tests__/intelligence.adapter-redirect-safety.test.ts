import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("playwright", () => ({
  chromium: {
    launch: vi.fn(async () => ({
      newPage: vi.fn(async () => ({
        goto: vi.fn(async () => undefined),
        url: () => "http://127.0.0.1/private",
        content: vi.fn(async () => "<html><body>secret</body></html>"),
      })),
      close: vi.fn(async () => undefined),
    })),
  },
}));

describe("intelligence.adapter-redirect-safety", () => {
  afterEach(() => {
    delete process.env.PLAYWRIGHT_ENABLED;
    delete process.env.CRAWL4AI_API_URL;
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("playwright rejects unsafe finalUrl after navigation", async () => {
    process.env.PLAYWRIGHT_ENABLED = "1";
    const { playwrightAdapter } = await import("@/services/intelligence/adapters/playwright-adapter");

    const result = await playwrightAdapter.crawlPage({ url: "https://example.com/" });

    expect(result.fetchStatus).toBe("failed");
    expect(result.error).toContain("SSRF prevention");
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
