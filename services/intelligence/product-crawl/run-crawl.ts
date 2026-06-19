import type { Json } from "@/lib/supabase/types";
import type { CrawlAdapterName, ProductCrawlResult, ProductPageType, ProductSiteFact } from "../types";
import { discoverPages, prioritizePageUrls } from "./discover-pages";
import { extractPage } from "./extract-page";
import { classifyAndExtractFacts } from "./extract-facts";
import { saveProductCrawl } from "../memory/save-product-crawl";
import { saveProductPage } from "../memory/save-product-page";
import { saveProductFacts } from "../memory/save-product-facts";

const DEFAULT_MAX_PAGES = 25;
const MIN_TOTAL_TEXT = 300;
const MAX_TOTAL_TEXT = 35_000;
const CONCURRENCY = 4;

export interface RunProductCrawlInput {
  projectId: string;
  url: string;
  maxPages?: number;
  persist?: boolean;
}

export async function runProductSiteCrawl(input: RunProductCrawlInput): Promise<ProductCrawlResult> {
  const normalizedUrl = normalizeProductUrl(input.url);
  const maxPages = Math.min(input.maxPages ?? DEFAULT_MAX_PAGES, 30);
  const persist = input.persist !== false;

  let crawlId: string | null = null;
  const adaptersUsed = new Set<CrawlAdapterName>();

  if (persist) {
    crawlId = await saveProductCrawl({
      projectId: input.projectId,
      sourceUrl: normalizedUrl,
      status: "running",
      primaryAdapter: "crawl4ai",
    });
  }

  const homepage = await extractPage({ url: normalizedUrl });
  adaptersUsed.add(homepage.adapterUsed);

  if (homepage.fetchStatus === "failed") {
    const result: ProductCrawlResult = {
      ok: false,
      crawlId,
      url: normalizedUrl,
      finalUrl: homepage.finalUrl,
      title: null,
      description: null,
      textSnippet: null,
      pages: [],
      facts: [],
      pagesDiscovered: 0,
      pagesCrawled: 0,
      pagesFailed: 1,
      adaptersUsed: [...adaptersUsed],
      error: homepage.error ?? "Website could not be read.",
    };

    if (persist && crawlId) {
      await saveProductCrawl({
        crawlId,
        projectId: input.projectId,
        sourceUrl: normalizedUrl,
        status: "failed",
        primaryAdapter: "crawl4ai",
        pagesDiscovered: 0,
        pagesCrawled: 0,
        pagesFailed: 1,
        error: result.error,
        completed: true,
      });
    }

    return result;
  }

  const discovered = homepage.html
    ? await discoverPages({ homepageUrl: homepage.finalUrl, homepageHtml: homepage.html, maxPages })
    : [];

  const targetUrls = prioritizePageUrls(homepage.finalUrl, discovered, maxPages);
  const pagesDiscovered = targetUrls.length;

  const extraUrls = targetUrls.filter((url) => url !== normalizeUrl(homepage.finalUrl));
  const extraPages = await mapWithConcurrency(extraUrls, CONCURRENCY, (url) => extractPage({ url }));

  const allPages = [homepage, ...extraPages];
  for (const page of allPages) adaptersUsed.add(page.adapterUsed);

  const classified = classifyAndExtractFacts(allPages, normalizedUrl);
  const facts = classified.flatMap((item) => item.facts);
  const pagesCrawled = allPages.filter((page) => page.fetchStatus === "success").length;
  const pagesFailed = allPages.length - pagesCrawled;

  const textSnippet = buildTextSnippet(classified);
  const ok = textSnippet.length >= MIN_TOTAL_TEXT;

  if (persist && crawlId) {
    const pageIdByUrl = new Map<string, string>();

    for (const item of classified) {
      const pageId = await saveProductPage({
        crawlId,
        projectId: input.projectId,
        page: item.page,
        pageType: item.pageType,
      });
      pageIdByUrl.set(item.page.finalUrl || item.page.url, pageId);

      const pageFacts = item.facts.map((fact) => ({
        ...fact,
        pageId,
      }));
      if (pageFacts.length) {
        await saveProductFacts({
          crawlId,
          projectId: input.projectId,
          facts: pageFacts,
        });
      }
    }

    await saveProductCrawl({
      crawlId,
      projectId: input.projectId,
      sourceUrl: normalizedUrl,
      status: ok ? (pagesFailed > 0 ? "partial" : "success") : "failed",
      primaryAdapter: "crawl4ai",
      fallbackAdapters: [...adaptersUsed].filter((name) => name !== "crawl4ai"),
      pagesDiscovered,
      pagesCrawled,
      pagesFailed,
      error: ok ? null : "Website returned too little readable product copy.",
      completed: true,
      metadata: { pageIdByUrl: Object.fromEntries(pageIdByUrl) } as Json,
    });
  }

  const homepageItem = classified[0];

  return {
    ok,
    crawlId,
    url: normalizedUrl,
    finalUrl: homepage.finalUrl,
    title: homepageItem?.page.title ?? null,
    description: homepageItem?.page.description ?? null,
    textSnippet: ok ? textSnippet : null,
    pages: allPages,
    facts,
    pagesDiscovered,
    pagesCrawled,
    pagesFailed,
    adaptersUsed: [...adaptersUsed],
    error: ok ? null : "Website returned too little readable product copy.",
  };
}

export function normalizeProductUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) throw new Error("Enter a website URL.");
  const withProtocol = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  const url = new URL(withProtocol);
  if (!["http:", "https:"].includes(url.protocol)) {
    throw new Error("Only HTTP and HTTPS URLs are supported.");
  }
  url.hash = "";
  return url.toString();
}

function buildTextSnippet(
  classified: Array<{ page: ProductCrawlResult["pages"][number]; pageType: ProductPageType; facts: ProductSiteFact[] }>
): string {
  return classified
    .filter((item) => item.page.fetchStatus === "success")
    .map((item) =>
      [
        `URL: ${item.page.finalUrl || item.page.url}`,
        `Page type: ${item.pageType}`,
        item.page.title ? `Title: ${item.page.title}` : "",
        item.page.description ? `Description: ${item.page.description}` : "",
        item.page.headings.length ? `Headings: ${item.page.headings.join(" | ")}` : "",
        item.page.ctas.length ? `CTAs: ${item.page.ctas.join(" | ")}` : "",
        item.page.markdown || item.page.bodyText,
      ]
        .filter(Boolean)
        .join("\n")
    )
    .join("\n\n---\n\n")
    .slice(0, MAX_TOTAL_TEXT);
}

async function mapWithConcurrency<T, R>(items: T[], concurrency: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let index = 0;

  async function worker() {
    while (index < items.length) {
      const current = index;
      index += 1;
      results[current] = await fn(items[current]);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, () => worker()));
  return results;
}

function normalizeUrl(url: string): string {
  const parsed = new URL(url);
  parsed.hash = "";
  return parsed.toString();
}
