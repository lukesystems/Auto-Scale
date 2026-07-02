import type { CrawledPageContent } from "../types";
import { crawl4aiAdapter } from "../adapters/crawl4ai-adapter";
import { playwrightAdapter } from "../adapters/playwright-adapter";
import { browserUseAdapter } from "../adapters/browser-use-adapter";
import { firecrawlCrawlAdapter } from "../adapters/firecrawl-adapter";
import { failedPageForUnsafeUrl, guardAdapterTargetUrl } from "../adapters/guard-url";
import { needsBrowserRender } from "../adapters/html-utils";

/** AutoBrief/onboarding: direct fetch then Firecrawl only. Default: full local adapter chain. */
export type ScrapeProfile = "autobrief" | "default";

export interface ExtractPageInput {
  url: string;
  scrapeProfile?: ScrapeProfile;
  allowPlaywright?: boolean;
  allowBrowserUse?: boolean;
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

  if (input.allowPlaywright !== false && playwrightAdapter.isAvailable()) {
    const rendered = await playwrightAdapter.crawlPage({ url: input.url, reason: "fallback" });
    if (rendered.fetchStatus === "success" && rendered.bodyText.length > page.bodyText.length) {
      page = rendered;
    }
  }

  if (
    page.fetchStatus === "failed" &&
    input.allowFirecrawl !== false &&
    firecrawlCrawlAdapter.isAvailable()
  ) {
    const firecrawl = await firecrawlCrawlAdapter.crawlPage({ url: input.url, reason: "fallback" });
    if (firecrawl.fetchStatus === "success") page = firecrawl;
  }

  if (
    page.fetchStatus === "failed" &&
    input.allowBrowserUse !== false &&
    browserUseAdapter.isAvailable()
  ) {
    const rescued = await browserUseAdapter.crawlPage({ url: input.url, reason: "fallback" });
    if (rescued.fetchStatus === "success") page = rescued;
  }

  return page;
}
