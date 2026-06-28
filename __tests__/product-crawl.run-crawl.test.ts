import { afterEach, describe, it, expect, vi } from "vitest";

vi.mock("@/services/autobrief/crawl-progress", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/services/autobrief/crawl-progress")>();
  return {
    ...actual,
    updateAutobriefProgress: vi.fn().mockResolvedValue(undefined),
  };
});

import { runProductSiteCrawl } from "@/services/intelligence/product-crawl/run-crawl";
import * as extractPageModule from "@/services/intelligence/product-crawl/extract-page";
import * as saveCrawlModule from "@/services/intelligence/memory/save-product-crawl";
import * as savePageModule from "@/services/intelligence/memory/save-product-page";
import * as saveFactsModule from "@/services/intelligence/memory/save-product-facts";

describe("product-crawl.run-crawl", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("persists crawl evidence when projectId is provided", async () => {
    vi.spyOn(saveCrawlModule, "saveProductCrawl")
      .mockResolvedValueOnce("crawl-1")
      .mockResolvedValueOnce("crawl-1");
    vi.spyOn(savePageModule, "saveProductPage").mockResolvedValue("page-1");
    vi.spyOn(saveFactsModule, "saveProductFacts").mockResolvedValue();

    vi.spyOn(extractPageModule, "extractPage").mockImplementation(async ({ url }) => ({
      url,
      finalUrl: url,
      title: "Acme",
      description: "AI for founders",
      headings: ["Fast setup"],
      ctas: ["Start trial"],
      bodyText: "x".repeat(500),
      markdown: "# Acme\n\n" + "x".repeat(500),
      html: "<html><body><h1>Acme</h1></body></html>",
      adapterUsed: "crawl4ai",
      fetchStatus: "success",
      error: null,
    }));

    const result = await runProductSiteCrawl({
      projectId: "project-1",
      url: "https://example.com/",
      maxPages: 3,
      persist: true,
    });

    expect(result.ok).toBe(true);
    expect(result.crawlId).toBe("crawl-1");
    expect(saveCrawlModule.saveProductCrawl).toHaveBeenCalled();
    expect(savePageModule.saveProductPage).toHaveBeenCalled();
    expect(saveFactsModule.saveProductFacts).toHaveBeenCalled();
  });

  it("fails safely for private URLs without persisting page rows", async () => {
    const savePageSpy = vi.spyOn(savePageModule, "saveProductPage");
    vi.spyOn(saveCrawlModule, "saveProductCrawl")
      .mockResolvedValueOnce("crawl-2")
      .mockResolvedValueOnce("crawl-2");

    const result = await runProductSiteCrawl({
      projectId: "project-1",
      url: "http://localhost/admin",
      maxPages: 3,
      persist: true,
    });

    expect(result.ok).toBe(false);
    expect(result.error).toContain("SSRF prevention");
    expect(savePageSpy).not.toHaveBeenCalled();
  });
});
