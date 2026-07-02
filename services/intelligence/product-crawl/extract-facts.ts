import type { CrawledPageContent, ProductSiteFact, ProductPageType } from "../types";
import { classifyPage } from "./classify-page";
import { llmClassifyPage, llmExtractPageFacts } from "./llm-extract";
import { pageFactsToProductFacts } from "./llm-facts-mapper";
import type { CrawlMode } from "./get-crawl-mode";

const PRICING_PATTERN = /(\$\d+[\d,]*(?:\.\d{2})?|\d+\s*(?:\/\s*)?(?:month|mo|year|yr)|free plan|enterprise plan|per user|per seat)/i;

export function extractFactsFromPage(
  page: CrawledPageContent,
  pageType: ProductPageType,
  isHomepage = false
): ProductSiteFact[] {
  const facts: ProductSiteFact[] = [];
  const sourceUrl = page.finalUrl || page.url;

  if (page.title) {
    facts.push({
      factType: isHomepage ? "product_name" : "other",
      factKey: "title",
      factValue: page.title,
      confidence: "high",
      evidenceSnippet: page.title,
      sourceUrl,
    });
  }

  if (page.description) {
    facts.push({
      factType: "tagline",
      factKey: "meta_description",
      factValue: page.description,
      confidence: "high",
      evidenceSnippet: page.description,
      sourceUrl,
    });
  }

  for (const heading of page.headings.slice(0, 15)) {
    const factType =
      pageType === "pricing"
        ? "pricing"
        : pageType === "features" || pageType === "product"
          ? "feature"
          : pageType === "about" || pageType === "solutions"
            ? "audience"
            : "other";

    facts.push({
      factType,
      factKey: "heading",
      factValue: heading,
      confidence: pageType === "other" ? "low" : "medium",
      evidenceSnippet: heading,
      sourceUrl,
    });
  }

  for (const cta of page.ctas) {
    facts.push({
      factType: "cta",
      factKey: "cta",
      factValue: cta,
      confidence: "high",
      evidenceSnippet: cta,
      sourceUrl,
    });
  }

  const pricingMatches = page.bodyText.match(new RegExp(PRICING_PATTERN.source, "gi")) ?? [];
  for (const match of [...new Set(pricingMatches)].slice(0, 5)) {
    facts.push({
      factType: "pricing",
      factKey: "pricing_mention",
      factValue: match,
      confidence: pageType === "pricing" ? "high" : "medium",
      evidenceSnippet: surroundingSnippet(page.bodyText, match),
      sourceUrl,
    });
  }

  return dedupeFacts(facts);
}

export function extractFactsFromPages(
  pages: Array<{ page: CrawledPageContent; pageType: ProductPageType; isHomepage?: boolean }>
): ProductSiteFact[] {
  const all = pages.flatMap(({ page, pageType, isHomepage }) =>
    extractFactsFromPage(page, pageType, isHomepage)
  );
  return dedupeFacts(all);
}

export function classifyAndExtractFacts(
  pages: CrawledPageContent[],
  homepageUrl: string
): Array<{ page: CrawledPageContent; pageType: ProductPageType; facts: ProductSiteFact[] }> {
  const homepageNormalized = normalizeUrl(homepageUrl);

  return pages.map((page) => {
    const isHomepage = normalizeUrl(page.finalUrl || page.url) === homepageNormalized;
    const pageType = classifyPage(page, isHomepage);
    const facts = extractFactsFromPage(page, pageType, isHomepage);
    return { page, pageType, facts };
  });
}

export async function classifyAndExtractFactsAsync(
  pages: CrawledPageContent[],
  homepageUrl: string,
  opts: {
    crawlMode: CrawlMode;
    projectId?: string;
    ownerId?: string;
    onPageExtracted?: (info: {
      url: string;
      pageType: ProductPageType;
      factCount: number;
      index: number;
      total: number;
    }) => void | Promise<void>;
  }
): Promise<
  Array<{
    page: CrawledPageContent;
    pageType: ProductPageType;
    facts: ProductSiteFact[];
    relevance?: number;
  }>
> {
  if (opts.crawlMode === "heuristic") {
    const classified = classifyAndExtractFacts(pages, homepageUrl);
    for (let index = 0; index < classified.length; index += 1) {
      const item = classified[index];
      if (item.page.fetchStatus !== "success") continue;
      await opts.onPageExtracted?.({
        url: item.page.finalUrl || item.page.url,
        pageType: item.pageType,
        factCount: item.facts.length,
        index,
        total: classified.length,
      });
    }
    return classified;
  }

  const homepageNormalized = normalizeUrl(homepageUrl);
  const results: Array<{
    page: CrawledPageContent;
    pageType: ProductPageType;
    facts: ProductSiteFact[];
    relevance?: number;
  }> = [];

  for (let index = 0; index < pages.length; index += 1) {
    const page = pages[index];
    if (page.fetchStatus !== "success") {
      results.push({ page, pageType: "other", facts: [] });
      continue;
    }

    const isHomepage = normalizeUrl(page.finalUrl || page.url) === homepageNormalized;
    const sourceUrl = page.finalUrl || page.url;

    const llmClass = await llmClassifyPage(page, {
      projectId: opts.projectId,
      ownerId: opts.ownerId,
    });
    const pageType = llmClass?.pageType ?? classifyPage(page, isHomepage);
    const relevance = llmClass?.relevance;

    const heuristicFacts = extractFactsFromPage(page, pageType, isHomepage);
    let llmFacts: ProductSiteFact[] = [];

    try {
      const extracted = await llmExtractPageFacts({
        page,
        url: sourceUrl,
        projectId: opts.projectId,
        ownerId: opts.ownerId,
        existingFacts: {
          features: heuristicFacts
            .filter((f) => f.factType === "feature")
            .map((f) => f.factValue),
          value_props: heuristicFacts
            .filter((f) => f.factType === "benefit")
            .map((f) => f.factValue),
        },
      });
      llmFacts = pageFactsToProductFacts(extracted.facts, sourceUrl);
    } catch (err) {
      console.warn("[product-crawl] llmExtractPageFacts failed, using heuristic facts", err);
    }

    const facts = dedupeFacts([...heuristicFacts, ...llmFacts]);
    results.push({ page, pageType, facts, relevance });

    await opts.onPageExtracted?.({
      url: sourceUrl,
      pageType,
      factCount: facts.length,
      index,
      total: pages.length,
    });
  }

  return results;
}

function surroundingSnippet(text: string, needle: string, radius = 80): string {
  const index = text.toLowerCase().indexOf(needle.toLowerCase());
  if (index < 0) return needle;
  const start = Math.max(0, index - radius);
  const end = Math.min(text.length, index + needle.length + radius);
  return text.slice(start, end).trim();
}

function dedupeFacts(facts: ProductSiteFact[]): ProductSiteFact[] {
  const seen = new Set<string>();
  return facts.filter((fact) => {
    const key = `${fact.factType}:${fact.factKey}:${fact.factValue.toLowerCase()}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function normalizeUrl(url: string): string {
  try {
    const parsed = new URL(url);
    parsed.hash = "";
    return parsed.toString();
  } catch {
    return url;
  }
}
