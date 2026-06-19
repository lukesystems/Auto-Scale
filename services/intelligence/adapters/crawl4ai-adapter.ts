import { safeFetchHtml } from "@/services/trendwatch/ingestion";
import type { CrawlAdapter, CrawlPageInput, CrawledPageContent, DiscoveredLink } from "../types";
import { failedPageForUnsafeUrl, guardAdapterTargetUrl } from "./guard-url";
import {
  cleanText,
  decodeHtml,
  extractBodyText,
  extractCtas,
  extractHeadings,
  extractPageMeta,
  htmlToMarkdown,
  stripTags,
} from "./html-utils";

const IMPORTANT_PATH_TERMS = [
  "pricing",
  "features",
  "product",
  "about",
  "solutions",
  "customers",
  "docs",
  "blog",
];

const CRAWL4AI_API_URL = () => process.env.CRAWL4AI_API_URL?.trim() || null;

export const crawl4aiAdapter: CrawlAdapter = {
  name: "crawl4ai",

  isAvailable() {
    return true;
  },

  async crawlPage(input: CrawlPageInput): Promise<CrawledPageContent> {
    try {
      await guardAdapterTargetUrl(input.url);
    } catch (error) {
      return failedPageForUnsafeUrl(input.url, error, "crawl4ai");
    }

    const externalApiUrl = CRAWL4AI_API_URL();
    if (externalApiUrl) {
      const external = await crawlViaExternalService(input.url, externalApiUrl);
      if (external) return external;
    }

    const fetched = await safeFetchHtml(input.url);
    if (!fetched.ok || !fetched.html) {
      return failedPage(input.url, fetched.finalUrl, fetched.error ?? "Fetch failed.");
    }

    return buildPageContent(fetched.finalUrl, fetched.html, "crawl4ai");
  },

  async discoverLinks(homepageUrl: string, html: string): Promise<DiscoveredLink[]> {
    const sitemapLinks = await discoverFromSitemap(homepageUrl);
    const internalLinks = discoverInternalLinks(homepageUrl, html);
    const merged = new Map<string, DiscoveredLink>();

    for (const link of [...sitemapLinks, ...internalLinks]) {
      const existing = merged.get(link.url);
      if (!existing || link.score > existing.score) merged.set(link.url, link);
    }

    return [...merged.values()].sort((a, b) => b.score - a.score);
  },
};

async function crawlViaExternalService(url: string, apiUrl: string): Promise<CrawledPageContent | null> {
  try {
    await guardAdapterTargetUrl(url);
  } catch (error) {
    return failedPageForUnsafeUrl(url, error, "crawl4ai");
  }

  try {
    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url, format: "markdown" }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) return null;

    const payload = (await response.json()) as {
      url?: string;
      markdown?: string;
      title?: string;
      description?: string;
      html?: string;
    };

    const finalUrl = payload.url ?? url;
    try {
      await guardAdapterTargetUrl(finalUrl);
    } catch (error) {
      return failedPageForUnsafeUrl(url, error, "crawl4ai");
    }

    const html = payload.html ?? "";
    const meta = html ? extractPageMeta(html) : { title: payload.title ?? null, description: payload.description ?? null };

    return {
      url,
      finalUrl,
      title: meta.title,
      description: meta.description,
      headings: html ? extractHeadings(html) : [],
      ctas: html ? extractCtas(html) : [],
      bodyText: payload.markdown ? cleanText(payload.markdown).slice(0, 12_000) : html ? extractBodyText(html) : "",
      markdown: payload.markdown ? cleanText(payload.markdown).slice(0, 20_000) : html ? htmlToMarkdown(html) : "",
      html: html || null,
      adapterUsed: "crawl4ai",
      fetchStatus: "success",
      error: null,
    };
  } catch {
    return null;
  }
}

function buildPageContent(finalUrl: string, html: string, adapter: "crawl4ai"): CrawledPageContent {
  const meta = extractPageMeta(html);
  const bodyText = extractBodyText(html);
  const markdown = htmlToMarkdown(html);

  return {
    url: finalUrl,
    finalUrl,
    title: meta.title,
    description: meta.description,
    headings: extractHeadings(html),
    ctas: extractCtas(html),
    bodyText,
    markdown,
    html,
    adapterUsed: adapter,
    fetchStatus: "success",
    error: null,
  };
}

function failedPage(url: string, finalUrl: string, error: string): CrawledPageContent {
  return {
    url,
    finalUrl,
    title: null,
    description: null,
    headings: [],
    ctas: [],
    bodyText: "",
    markdown: "",
    html: null,
    adapterUsed: "crawl4ai",
    fetchStatus: "failed",
    error,
  };
}

function discoverInternalLinks(homepageUrl: string, html: string): DiscoveredLink[] {
  const base = new URL(homepageUrl);
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];

  return matches
    .map((match) => {
      try {
        const url = new URL(decodeHtml(match[1] ?? ""), base);
        url.hash = "";
        const anchorText = stripTags(match[2] ?? "").toLowerCase();
        const path = url.pathname.toLowerCase();
        return {
          url: url.toString(),
          anchorText,
          path,
          score: scoreImportantLink({ text: anchorText, path }),
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is DiscoveredLink => Boolean(item))
    .filter((item) => {
      try {
        return new URL(item.url).origin === base.origin;
      } catch {
        return false;
      }
    })
    .filter((item) => IMPORTANT_PATH_TERMS.some((term) => item.path.includes(term) || item.anchorText.includes(term)));
}

async function discoverFromSitemap(homepageUrl: string): Promise<DiscoveredLink[]> {
  const base = new URL(homepageUrl);
  const candidates = [
    new URL("/sitemap.xml", base).toString(),
    new URL("/sitemap_index.xml", base).toString(),
  ];

  const links: DiscoveredLink[] = [];

  for (const sitemapUrl of candidates) {
    const fetched = await safeFetchHtml(sitemapUrl);
    if (!fetched.ok || !fetched.html) continue;

    const locMatches = [...fetched.html.matchAll(/<loc>([^<]+)<\/loc>/gi)];
    for (const match of locMatches) {
      try {
        const url = new URL(match[1]?.trim() ?? "");
        if (url.origin !== base.origin) continue;
        const path = url.pathname.toLowerCase();
        links.push({
          url: url.toString(),
          anchorText: "",
          path,
          score: scoreImportantLink({ text: "", path }),
        });
      } catch {
        // skip invalid loc
      }
    }
  }

  return links;
}

function scoreImportantLink(item: { text: string; path: string }): number {
  return IMPORTANT_PATH_TERMS.reduce((score, term, index) => {
    const weight = IMPORTANT_PATH_TERMS.length - index;
    return score + (item.path.includes(term) ? weight * 2 : 0) + (item.text.includes(term) ? weight : 0);
  }, 0);
}
