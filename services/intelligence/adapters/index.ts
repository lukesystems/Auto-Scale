import type { CrawlAdapter, CrawlAdapterName, SearchAdapter, SearchAdapterName } from "../types";
import { crawl4aiAdapter } from "./crawl4ai-adapter";
import { firecrawlCrawlAdapter, firecrawlSearchAdapter } from "./firecrawl-adapter";

export const crawlAdapters: CrawlAdapter[] = [
  crawl4aiAdapter,
  firecrawlCrawlAdapter,
];

export const searchAdapters: SearchAdapter[] = [
  firecrawlSearchAdapter,
];

export function getCrawlAdapter(name: CrawlAdapterName): CrawlAdapter | undefined {
  return crawlAdapters.find((adapter) => adapter.name === name);
}

export function getSearchAdapter(name: SearchAdapterName): SearchAdapter | undefined {
  return searchAdapters.find((adapter) => adapter.name === name);
}

export async function getAvailableSearchAdapter(preferred: SearchAdapterName = "firecrawl"): Promise<SearchAdapter | null> {
  const preferredAdapter = getSearchAdapter(preferred);
  if (preferredAdapter?.isAvailable()) return preferredAdapter;

  return searchAdapters.find((adapter) => adapter.isAvailable()) ?? null;
}
