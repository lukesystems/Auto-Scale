export { runProductSiteCrawl, normalizeProductUrl } from "./product-crawl/run-crawl";
export type { RunProductCrawlInput } from "./product-crawl/run-crawl";
export { runDiscovery, planDiscovery, loadDiscoveryContext } from "./discovery";
export { runDeepDiscovery } from "./deep-discovery";
export type {
  RunDeepDiscoveryResult,
  DeepDiscoveryRoundTrace,
  MarketSynthesis,
  CompetitorStrategyProfile,
} from "./deep-discovery";
export { runPatternMining, loadPatternMiningContext } from "./patterns";
export { scorePatterns, scoreSource } from "./scoring";
export type { RunDiscoveryResult, DiscoveryPlan, DiscoveryContext } from "./discovery";
export type { RunPatternMiningResult, MinedPattern, PatternType } from "./patterns";
export type {
  ProductCrawlResult,
  ProductSiteFact,
  CrawledPageContent,
  ProductPageType,
} from "./types";
