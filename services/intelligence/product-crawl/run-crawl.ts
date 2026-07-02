import type { Json } from "@/lib/supabase/types";
import type { CrawlAdapterName, ProductCrawlResult, ProductPageType, ProductSiteFact } from "../types";
import { discoverPages, prioritizePageUrls } from "./discover-pages";
import { extractPage, type ScrapeProfile } from "./extract-page";
import { classifyAndExtractFactsAsync } from "./extract-facts";
import { getCrawlModeForProject } from "./get-crawl-mode";
import { summarizeLlmFacts } from "./llm-facts-mapper";
import { saveProductCrawl } from "../memory/save-product-crawl";
import { saveProductPage } from "../memory/save-product-page";
import { saveProductFacts } from "../memory/save-product-facts";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  pageExtractMessage,
  pageFetchMessage,
  pathnameLabel,
  updateAutobriefProgress,
} from "@/services/autobrief/crawl-progress";

const DEFAULT_MAX_PAGES = 25;
const MIN_TOTAL_TEXT = 300;
const MAX_TOTAL_TEXT = 35_000;
const CONCURRENCY = 4;

export interface RunProductCrawlInput {
  projectId: string;
  url: string;
  maxPages?: number;
  persist?: boolean;
  /** AutoBrief uses direct HTTP + Firecrawl fallback only. */
  scrapeProfile?: ScrapeProfile;
  /** When set, reuse an existing crawl row (for progress polling). */
  existingCrawlId?: string;
}

export async function runProductSiteCrawl(input: RunProductCrawlInput): Promise<ProductCrawlResult> {
  const normalizedUrl = normalizeProductUrl(input.url);
  const maxPages = Math.min(input.maxPages ?? DEFAULT_MAX_PAGES, 30);
  const persist = input.persist !== false;

  let crawlId: string | null = null;
  const adaptersUsed = new Set<CrawlAdapterName>();

  if (persist) {
    crawlId =
      input.existingCrawlId ??
      (await saveProductCrawl({
        projectId: input.projectId,
        sourceUrl: normalizedUrl,
        status: "running",
        primaryAdapter: "crawl4ai",
      }));
  }

  const progressCrawlId = persist ? crawlId : null;

  await reportProgress(progressCrawlId, {
    phase: "crawl",
    currentMessage: pageFetchMessage(normalizedUrl, "crawl4ai", "running"),
    event: {
      kind: "page_fetch",
      message: pageFetchMessage(normalizedUrl, "crawl4ai", "running"),
      url: normalizedUrl,
      pathname: pathnameLabel(normalizedUrl),
      adapter: "crawl4ai",
      status: "running",
    },
  });

  const homepage = await extractPage({ url: normalizedUrl, scrapeProfile: input.scrapeProfile });
  adaptersUsed.add(homepage.adapterUsed);

  await reportProgress(progressCrawlId, {
    pagesCrawled: homepage.fetchStatus === "success" ? 1 : 0,
    currentMessage: pageFetchMessage(
      homepage.finalUrl || normalizedUrl,
      homepage.adapterUsed,
      homepage.fetchStatus === "success" ? "success" : "failed"
    ),
    event: {
      kind: "page_fetch",
      message: pageFetchMessage(
        homepage.finalUrl || normalizedUrl,
        homepage.adapterUsed,
        homepage.fetchStatus === "success" ? "success" : "failed"
      ),
      url: homepage.finalUrl || normalizedUrl,
      pathname: pathnameLabel(homepage.finalUrl || normalizedUrl),
      adapter: homepage.adapterUsed,
      status: homepage.fetchStatus === "success" ? "success" : "failed",
    },
  });

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
      await updateAutobriefProgress(crawlId, {
        phase: "failed",
        currentMessage: result.error ?? "Website could not be read.",
        event: {
          kind: "error",
          message: result.error ?? "Website could not be read.",
          status: "failed",
        },
      });
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

  await reportProgress(progressCrawlId, {
    pagesDiscovered,
    currentMessage:
      pagesDiscovered > 1
        ? `Found ${pagesDiscovered} pages to scan…`
        : "Scanning homepage…",
    event: {
      kind: "info",
      message:
        pagesDiscovered > 1
          ? `Found ${pagesDiscovered} pages to scan…`
          : "Scanning homepage…",
      status: "running",
    },
  });

  const extraUrls = targetUrls.filter((url) => url !== normalizeUrl(homepage.finalUrl));
  let pagesCrawledSoFar = homepage.fetchStatus === "success" ? 1 : 0;

  const extraPages = await mapWithConcurrency(extraUrls, CONCURRENCY, async (url) => {
    await reportProgress(progressCrawlId, {
      currentMessage: pageFetchMessage(url, "crawl4ai", "running"),
      event: {
        kind: "page_fetch",
        message: pageFetchMessage(url, "crawl4ai", "running"),
        url,
        pathname: pathnameLabel(url),
        adapter: "crawl4ai",
        status: "running",
      },
    });

    const page = await extractPage({ url, scrapeProfile: input.scrapeProfile });

    if (page.fetchStatus === "success") {
      pagesCrawledSoFar += 1;
    }

    await reportProgress(progressCrawlId, {
      pagesCrawled: pagesCrawledSoFar,
      currentMessage: pageFetchMessage(url, page.adapterUsed, page.fetchStatus === "success" ? "success" : "failed"),
      event: {
        kind: "page_fetch",
        message: pageFetchMessage(url, page.adapterUsed, page.fetchStatus === "success" ? "success" : "failed"),
        url: page.finalUrl || url,
        pathname: pathnameLabel(page.finalUrl || url),
        adapter: page.adapterUsed,
        status: page.fetchStatus === "success" ? "success" : "failed",
      },
    });

    return page;
  });

  const allPages = [homepage, ...extraPages];
  for (const page of allPages) adaptersUsed.add(page.adapterUsed);

  const crawlMode = await getCrawlModeForProject(input.projectId);
  let ownerId: string | undefined;
  if (isSupabaseConfigured() && persist) {
    const supabase = createSupabaseServerClient();
    const { data: project } = await supabase
      .from("projects")
      .select("owner_id")
      .eq("id", input.projectId)
      .maybeSingle();
    ownerId = project?.owner_id ?? undefined;
  }

  await reportProgress(progressCrawlId, {
    phase: "extract",
    currentMessage: "Extracting product signals from pages…",
    event: {
      kind: "phase",
      message: "Extracting product signals from pages…",
      status: "running",
    },
  });

  let factsFoundSoFar = 0;
  const classified = await classifyAndExtractFactsAsync(allPages, normalizedUrl, {
    crawlMode,
    projectId: input.projectId,
    ownerId,
    onPageExtracted: async (info) => {
      factsFoundSoFar += info.factCount;
      await reportProgress(progressCrawlId, {
        factsFound: factsFoundSoFar,
        currentMessage: pageExtractMessage(info.pageType, info.factCount, info.url),
        event: {
          kind: "page_extract",
          message: pageExtractMessage(info.pageType, info.factCount, info.url),
          url: info.url,
          pathname: pathnameLabel(info.url),
          pageType: info.pageType,
          factCount: info.factCount,
          status: "success",
        },
      });
    },
  });
  const facts = classified.flatMap((item) => item.facts);
  const pagesCrawled = allPages.filter((page) => page.fetchStatus === "success").length;
  const pagesFailed = allPages.length - pagesCrawled;

  const textSnippet = buildTextSnippet(classified);
  const llmFactsSummary = crawlMode === "llm" ? summarizeLlmFacts(classified) : null;
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
    llmFactsSummary: ok ? llmFactsSummary : null,
    crawlMode,
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

async function reportProgress(
  crawlId: string | null,
  input: Parameters<typeof updateAutobriefProgress>[1]
): Promise<void> {
  if (!crawlId) return;
  await updateAutobriefProgress(crawlId, input);
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
