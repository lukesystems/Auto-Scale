import type { CrawledPageContent } from "../types";
import { crawl4aiAdapter } from "../adapters/crawl4ai-adapter";
import { playwrightAdapter } from "../adapters/playwright-adapter";
import { browserUseAdapter } from "../adapters/browser-use-adapter";
import { firecrawlCrawlAdapter } from "../adapters/firecrawl-adapter";
import { needsBrowserRender } from "../adapters/html-utils";

export interface ExtractPageInput {
  url: string;
  allowPlaywright?: boolean;
  allowBrowserUse?: boolean;
  allowFirecrawl?: boolean;
}

export async function extractPage(input: ExtractPageInput): Promise<CrawledPageContent> {
  let page = await crawl4aiAdapter.crawlPage({ url: input.url, reason: "primary" });

  const shouldFallback =
    page.fetchStatus === "failed" ||
    needsBrowserRender(page.html, page.bodyText);

  if (shouldFallback && input.allowPlaywright !== false && playwrightAdapter.isAvailable()) {
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
