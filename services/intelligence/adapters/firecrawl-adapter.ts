import type { CrawlAdapter, CrawlPageInput, CrawledPageContent, SearchAdapter, SearchResult } from "../types";
import { failedPageForUnsafeUrl, filterSafeResultUrls, guardAdapterTargetUrl } from "./guard-url";
import {
  cleanText,
  extractBodyText,
  extractCtas,
  extractHeadings,
  extractPageMeta,
  htmlToMarkdown,
} from "./html-utils";

const FIRECRAWL_API_KEY = process.env.FIRECRAWL_API_KEY?.trim() || null;
const FIRECRAWL_API_URL = (process.env.FIRECRAWL_API_URL?.trim() || "https://api.firecrawl.dev").replace(/\/$/, "");

export const firecrawlCrawlAdapter: CrawlAdapter = {
  name: "firecrawl",

  isAvailable() {
    return Boolean(FIRECRAWL_API_KEY);
  },

  async crawlPage(input: CrawlPageInput): Promise<CrawledPageContent> {
    try {
      await guardAdapterTargetUrl(input.url);
    } catch (error) {
      return failedPageForUnsafeUrl(input.url, error, "firecrawl");
    }

    if (!FIRECRAWL_API_KEY) {
      return failedPage(input.url, "FIRECRAWL_API_KEY is not configured.");
    }

    try {
      const response = await fetch(`${FIRECRAWL_API_URL}/v1/scrape`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
        },
        body: JSON.stringify({ url: input.url, formats: ["markdown", "html"] }),
        signal: AbortSignal.timeout(45_000),
      });

      if (!response.ok) {
        return failedPage(input.url, `Firecrawl scrape failed: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        data?: { markdown?: string; html?: string; metadata?: { title?: string; description?: string; sourceURL?: string } };
      };

      const data = payload.data;
      const html = data?.html ?? "";
      const meta = html ? extractPageMeta(html) : { title: data?.metadata?.title ?? null, description: data?.metadata?.description ?? null };

      let finalUrl = input.url;
      if (data?.metadata?.sourceURL) {
        try {
          await guardAdapterTargetUrl(data.metadata.sourceURL);
          finalUrl = data.metadata.sourceURL;
        } catch {
          return failedPage(input.url, "Firecrawl returned an unsafe redirect URL.");
        }
      }

      return {
        url: input.url,
        finalUrl,
        title: meta.title,
        description: meta.description,
        headings: html ? extractHeadings(html) : [],
        ctas: html ? extractCtas(html) : [],
        bodyText: data?.markdown ? cleanText(data.markdown).slice(0, 12_000) : html ? extractBodyText(html) : "",
        markdown: data?.markdown ? cleanText(data.markdown).slice(0, 20_000) : html ? htmlToMarkdown(html) : "",
        html: html || null,
        adapterUsed: "firecrawl",
        fetchStatus: "success",
        error: null,
      };
    } catch (error) {
      return failedPage(input.url, error instanceof Error ? error.message : "Firecrawl scrape failed.");
    }
  },
};

export const firecrawlSearchAdapter: SearchAdapter = {
  name: "firecrawl",

  isAvailable() {
    return Boolean(FIRECRAWL_API_KEY);
  },

  async search(query: string, options?: { limit?: number }): Promise<SearchResult[]> {
    if (!FIRECRAWL_API_KEY) {
      throw new Error("FIRECRAWL_API_KEY is not configured.");
    }

    const response = await fetch(`${FIRECRAWL_API_URL}/v1/search`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${FIRECRAWL_API_KEY}`,
      },
      body: JSON.stringify({ query, limit: options?.limit ?? 10 }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      throw new Error(`Firecrawl search failed: HTTP ${response.status}`);
    }

    const payload = (await response.json()) as {
      data?: Array<{ url?: string; title?: string; description?: string }>;
    };

    return filterSafeResultUrls(
      (payload.data ?? [])
        .filter((item) => item.url)
        .map((item) => ({
          url: item.url!,
          title: item.title ?? null,
          snippet: item.description ?? null,
          publishedAt: null,
        }))
    );
  },
};

function failedPage(url: string, error: string): CrawledPageContent {
  return {
    url,
    finalUrl: url,
    title: null,
    description: null,
    headings: [],
    ctas: [],
    bodyText: "",
    markdown: "",
    html: null,
    adapterUsed: "firecrawl",
    fetchStatus: "failed",
    error,
  };
}
