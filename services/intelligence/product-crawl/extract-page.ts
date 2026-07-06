import type { CrawledPageContent } from "../types";
import { crawl4aiAdapter } from "../adapters/crawl4ai-adapter";
import { firecrawlCrawlAdapter } from "../adapters/firecrawl-adapter";
import { failedPageForUnsafeUrl, guardAdapterTargetUrl } from "../adapters/guard-url";
import { needsBrowserRender } from "../adapters/html-utils";

/** AutoBrief/onboarding: direct fetch then Firecrawl only. Default: full local adapter chain. */
export type ScrapeProfile = "autobrief" | "default";

export interface ExtractPageInput {
  url: string;
  scrapeProfile?: ScrapeProfile;
  allowFirecrawl?: boolean;
}

export async function extractPage(input: ExtractPageInput): Promise<CrawledPageContent> {
  try {
    await guardAdapterTargetUrl(input.url);
  } catch (error) {
    return failedPageForUnsafeUrl(input.url, error, "crawl4ai");
  }

  const profile = input.scrapeProfile ?? "default";

  let page = await crawl4aiAdapter.crawlPage({ url: input.url, reason: "primary" });

  const needsRescue =
    page.fetchStatus === "failed" || needsBrowserRender(page.html, page.bodyText);

  if (!needsRescue) {
    return page;
  }

  if (profile === "autobrief") {
    if (input.allowFirecrawl !== false && firecrawlCrawlAdapter.isAvailable()) {
      const firecrawl = await firecrawlCrawlAdapter.crawlPage({ url: input.url, reason: "fallback" });
      if (firecrawl.fetchStatus === "success") return firecrawl;
    }
    return page;
  }

  if (
    page.fetchStatus === "failed" &&
    input.allowFirecrawl !== false &&
    firecrawlCrawlAdapter.isAvailable()
  ) {
    const firecrawl = await firecrawlCrawlAdapter.crawlPage({ url: input.url, reason: "fallback" });
    if (firecrawl.fetchStatus === "success") page = firecrawl;
  }

  return page;
}
