import { describe, it, expect } from "vitest";
import {
  assertSafePublicHttpUrl,
  UnsafeUrlError,
} from "@/services/trendwatch/ingestion";
import { filterSafeResultUrls } from "@/services/intelligence/adapters/guard-url";
import { playwrightAdapter } from "@/services/intelligence/adapters/playwright-adapter";

describe("intelligence adapter URL safety", () => {
  it.each([
    "http://127.0.0.1/",
    "http://localhost/admin",
    "http://192.168.1.1/internal",
    "file:///etc/passwd",
  ])("rejects unsafe URL %s", async (url) => {
    await expect(assertSafePublicHttpUrl(url)).rejects.toBeInstanceOf(UnsafeUrlError);
  });

  it("filters unsafe URLs from search-style result lists", async () => {
    const safe = await filterSafeResultUrls([
      { url: "https://example.com/safe", title: "Safe" },
      { url: "http://127.0.0.1/private", title: "Unsafe" },
    ]);

    expect(safe).toHaveLength(1);
    expect(safe[0]?.url).toBe("https://example.com/safe");
  });

  it("playwright adapter rejects private URLs before launch", async () => {
    process.env.PLAYWRIGHT_ENABLED = "1";
    const result = await playwrightAdapter.crawlPage({ url: "http://127.0.0.1/private" });
    expect(result.fetchStatus).toBe("failed");
    expect(result.error).toContain("SSRF prevention");
    delete process.env.PLAYWRIGHT_ENABLED;
  });
});
