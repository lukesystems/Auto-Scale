import type { DiscoveredLink, ProductPageType } from "../types";
import { crawl4aiAdapter } from "../adapters/crawl4ai-adapter";

const DEFAULT_MAX_PAGES = 25;
const MIN_SCORE = 1;

export interface DiscoverPagesInput {
  homepageUrl: string;
  homepageHtml: string;
  maxPages?: number;
}

export async function discoverPages(input: DiscoverPagesInput): Promise<DiscoveredLink[]> {
  const maxPages = input.maxPages ?? DEFAULT_MAX_PAGES;
  const discovered = crawl4aiAdapter.discoverLinks
    ? await crawl4aiAdapter.discoverLinks(input.homepageUrl, input.homepageHtml)
    : [];

  const homepagePath = new URL(input.homepageUrl).pathname.toLowerCase();
  const isHomeOnly = homepagePath === "/" || homepagePath === "";

  const filtered = discovered
    .filter((link) => link.score >= MIN_SCORE)
    .filter((link) => {
      try {
        return new URL(link.url).origin === new URL(input.homepageUrl).origin;
      } catch {
        return false;
      }
    });

  if (isHomeOnly) {
    return filtered.slice(0, maxPages - 1);
  }

  return filtered.slice(0, maxPages);
}

export function prioritizePageUrls(homepageUrl: string, discovered: DiscoveredLink[], maxPages: number): string[] {
  const seen = new Set<string>();
  const ordered: string[] = [];

  const push = (url: string) => {
    const normalized = normalizeUrl(url);
    if (seen.has(normalized)) return;
    seen.add(normalized);
    ordered.push(normalized);
  };

  push(homepageUrl);
  for (const link of discovered.sort((a, b) => b.score - a.score)) {
    push(link.url);
    if (ordered.length >= maxPages) break;
  }

  return ordered.slice(0, maxPages);
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}
