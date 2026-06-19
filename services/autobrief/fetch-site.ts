import type { SiteFetchInput, SiteFetchOutput, ExtractedPage } from "./fetch-site.types";
import { runProductSiteCrawl, normalizeProductUrl } from "@/services/intelligence/product-crawl/run-crawl";

export type { SiteFetchInput, SiteFetchOutput, ExtractedPage } from "./fetch-site.types";
export { normalizeProductUrl } from "@/services/intelligence/product-crawl/run-crawl";
export { safeFetchUrl, type SafeFetchResult } from "@/services/trendwatch/ingestion";

/**
 * Backward-compatible AutoBrief site fetch.
 * Delegates to Product Site Intelligence when projectId is provided (persists evidence).
 */
export async function fetchSiteForAutoBrief(
  input: SiteFetchInput & { projectId?: string }
): Promise<SiteFetchOutput> {
  if (input.projectId) {
    const crawl = await runProductSiteCrawl({
      projectId: input.projectId,
      url: input.url,
      maxPages: 25,
      persist: true,
    });

    return {
      ok: crawl.ok,
      url: crawl.url,
      finalUrl: crawl.finalUrl,
      title: crawl.title,
      description: crawl.description,
      textSnippet: crawl.textSnippet,
      pages: crawl.pages
        .filter((page) => page.fetchStatus === "success")
        .map(toExtractedPage),
      crawlId: crawl.crawlId,
      factsCount: crawl.facts.length,
      error: crawl.error,
    };
  }

  const crawl = await runProductSiteCrawl({
    projectId: "00000000-0000-0000-0000-000000000000",
    url: input.url,
    maxPages: 5,
    persist: false,
  });

  return {
    ok: crawl.ok,
    url: crawl.url,
    finalUrl: crawl.finalUrl,
    title: crawl.title,
    description: crawl.description,
    textSnippet: crawl.textSnippet,
    pages: crawl.pages
      .filter((page) => page.fetchStatus === "success")
      .map(toExtractedPage),
    error: crawl.error,
  };
}

function toExtractedPage(page: {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  headings: string[];
  ctas: string[];
  bodyText: string;
}): ExtractedPage {
  return {
    url: page.finalUrl || page.url,
    title: page.title,
    description: page.description,
    headings: page.headings,
    ctas: page.ctas,
    bodyText: page.bodyText,
  };
}
