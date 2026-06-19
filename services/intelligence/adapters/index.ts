import type { CrawlAdapter, CrawlAdapterName, SearchAdapter, SearchAdapterName } from "../types";
import { braveSearchAdapter } from "./brave-search-adapter";
import { browserUseAdapter } from "./browser-use-adapter";
import { crawl4aiAdapter } from "./crawl4ai-adapter";
import { exaSearchAdapter } from "./exa-search-adapter";
import { firecrawlCrawlAdapter, firecrawlSearchAdapter } from "./firecrawl-adapter";
import { playwrightAdapter } from "./playwright-adapter";

export const crawlAdapters: CrawlAdapter[] = [
  crawl4aiAdapter,
  playwrightAdapter,
  firecrawlCrawlAdapter,
  browserUseAdapter,
];

export const searchAdapters: SearchAdapter[] = [
  exaSearchAdapter,
  braveSearchAdapter,
  firecrawlSearchAdapter,
];

export function getCrawlAdapter(name: CrawlAdapterName): CrawlAdapter | undefined {
  return crawlAdapters.find((adapter) => adapter.name === name);
}

export function getSearchAdapter(name: SearchAdapterName): SearchAdapter | undefined {
  return searchAdapters.find((adapter) => adapter.name === name);
}

export async function getAvailableSearchAdapter(preferred: SearchAdapterName = "exa"): Promise<SearchAdapter | null> {
  const preferredAdapter = getSearchAdapter(preferred);
  if (preferredAdapter?.isAvailable()) return preferredAdapter;

  return searchAdapters.find((adapter) => adapter.isAvailable()) ?? null;
}
