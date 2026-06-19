export type CrawlAdapterName = "crawl4ai" | "playwright" | "firecrawl" | "browser-use";
export type SearchAdapterName = "exa" | "brave" | "firecrawl";

export type ProductPageType =
  | "home"
  | "pricing"
  | "features"
  | "product"
  | "about"
  | "solutions"
  | "customers"
  | "blog"
  | "docs"
  | "contact"
  | "legal"
  | "other";

export type ProductFactType =
  | "product_name"
  | "tagline"
  | "feature"
  | "benefit"
  | "pricing"
  | "cta"
  | "audience"
  | "pain_point"
  | "competitor_mention"
  | "other";

export type ConfidenceLevel = "low" | "medium" | "high";

export type CrawlRunStatus = "running" | "success" | "partial" | "failed";

export interface CrawledPageContent {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  headings: string[];
  ctas: string[];
  bodyText: string;
  markdown: string;
  html: string | null;
  adapterUsed: CrawlAdapterName;
  fetchStatus: "success" | "failed";
  error: string | null;
}

export interface DiscoveredLink {
  url: string;
  anchorText: string;
  path: string;
  score: number;
}

export interface ProductSiteFact {
  factType: ProductFactType;
  factKey: string | null;
  factValue: string;
  confidence: ConfidenceLevel;
  evidenceSnippet: string | null;
  sourceUrl: string;
  pageId?: string;
}

export interface ProductCrawlResult {
  ok: boolean;
  crawlId: string | null;
  url: string;
  finalUrl: string | null;
  title: string | null;
  description: string | null;
  textSnippet: string | null;
  pages: CrawledPageContent[];
  facts: ProductSiteFact[];
  pagesDiscovered: number;
  pagesCrawled: number;
  pagesFailed: number;
  adaptersUsed: CrawlAdapterName[];
  error: string | null;
}

export interface SearchResult {
  url: string;
  title: string | null;
  snippet: string | null;
  publishedAt: string | null;
}

export interface CrawlPageInput {
  url: string;
  reason?: "primary" | "fallback";
}

export interface CrawlAdapter {
  name: CrawlAdapterName;
  isAvailable(): boolean | Promise<boolean>;
  crawlPage(input: CrawlPageInput): Promise<CrawledPageContent>;
  discoverLinks?(homepageUrl: string, html: string): Promise<DiscoveredLink[]>;
}

export interface SearchAdapter {
  name: SearchAdapterName;
  isAvailable(): boolean;
  search(query: string, options?: { limit?: number }): Promise<SearchResult[]>;
}
