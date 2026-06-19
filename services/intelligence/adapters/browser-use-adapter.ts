import type { CrawlAdapter, CrawlPageInput, CrawledPageContent } from "../types";

const BROWSER_USE_API_URL = process.env.BROWSER_USE_API_URL?.trim() || null;

/**
 * Rescue adapter for pages that need interaction (tabs, expanders).
 * Not for login or bypassing restrictions.
 */
export const browserUseAdapter: CrawlAdapter = {
  name: "browser-use",

  isAvailable() {
    return Boolean(BROWSER_USE_API_URL);
  },

  async crawlPage(input: CrawlPageInput): Promise<CrawledPageContent> {
    if (!BROWSER_USE_API_URL) {
      return failedPage(input.url, "BROWSER_USE_API_URL is not configured.");
    }

    try {
      const response = await fetch(BROWSER_USE_API_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          url: input.url,
          task: "Extract all visible public product information from this page. Do not log in.",
        }),
        signal: AbortSignal.timeout(90_000),
      });

      if (!response.ok) {
        return failedPage(input.url, `Browser-use rescue failed: HTTP ${response.status}`);
      }

      const payload = (await response.json()) as {
        url?: string;
        markdown?: string;
        text?: string;
        title?: string;
      };

      const bodyText = (payload.markdown ?? payload.text ?? "").slice(0, 12_000);

      return {
        url: input.url,
        finalUrl: payload.url ?? input.url,
        title: payload.title ?? null,
        description: null,
        headings: [],
        ctas: [],
        bodyText,
        markdown: bodyText,
        html: null,
        adapterUsed: "browser-use",
        fetchStatus: bodyText.length > 0 ? "success" : "failed",
        error: bodyText.length > 0 ? null : "Browser-use returned no content.",
      };
    } catch (error) {
      return failedPage(input.url, error instanceof Error ? error.message : "Browser-use rescue failed.");
    }
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
    adapterUsed: "browser-use",
    fetchStatus: "failed",
    error,
  };
}
