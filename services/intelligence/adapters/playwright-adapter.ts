import type { CrawlAdapter, CrawlPageInput, CrawledPageContent } from "../types";
import {
  extractBodyText,
  extractCtas,
  extractHeadings,
  extractPageMeta,
  htmlToMarkdown,
} from "./html-utils";

const PLAYWRIGHT_ENABLED = process.env.PLAYWRIGHT_ENABLED === "1" || process.env.PLAYWRIGHT_ENABLED === "true";

export const playwrightAdapter: CrawlAdapter = {
  name: "playwright",

  isAvailable() {
    return PLAYWRIGHT_ENABLED;
  },

  async crawlPage(input: CrawlPageInput): Promise<CrawledPageContent> {
    if (!PLAYWRIGHT_ENABLED) {
      return {
        url: input.url,
        finalUrl: input.url,
        title: null,
        description: null,
        headings: [],
        ctas: [],
        bodyText: "",
        markdown: "",
        html: null,
        adapterUsed: "playwright",
        fetchStatus: "failed",
        error: "Playwright fallback is disabled. Set PLAYWRIGHT_ENABLED=1 and install playwright.",
      };
    }

    try {
      const playwright = await import("playwright");
      const browser = await playwright.chromium.launch({ headless: true });

      try {
        const page = await browser.newPage();
        await page.goto(input.url, { waitUntil: "networkidle", timeout: 20_000 });
        const finalUrl = page.url();
        const html = await page.content();
        const meta = extractPageMeta(html);

        return {
          url: input.url,
          finalUrl,
          title: meta.title,
          description: meta.description,
          headings: extractHeadings(html),
          ctas: extractCtas(html),
          bodyText: extractBodyText(html),
          markdown: htmlToMarkdown(html),
          html,
          adapterUsed: "playwright",
          fetchStatus: "success",
          error: null,
        };
      } finally {
        await browser.close();
      }
    } catch (error) {
      return {
        url: input.url,
        finalUrl: input.url,
        title: null,
        description: null,
        headings: [],
        ctas: [],
        bodyText: "",
        markdown: "",
        html: null,
        adapterUsed: "playwright",
        fetchStatus: "failed",
        error: error instanceof Error ? error.message : "Playwright render failed.",
      };
    }
  },
};
