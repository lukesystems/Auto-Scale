import { extractPage } from "../product-crawl/extract-page";
import type { CrawledPageContent } from "../types";
import { canonicalizeUrl } from "../discovery/dedupe-candidates";
import { assertSafePublicHttpUrl, isSafeHostname } from "@/services/trendwatch/ingestion";

export type DeepEnrichStatus = "pending" | "enriching" | "enriched" | "failed" | "skipped";

export interface CompetitorPageEnrichment {
  url: string;
  pageType: CompetitorPageType;
  status: "success" | "failed";
  error?: string;
  title: string | null;
  headings: string[];
  ctas: string[];
  bodyTextPreview: string;
  extracted: CompetitorIntelligence | null;
}

export type CompetitorPageType =
  | "homepage"
  | "pricing"
  | "features"
  | "product"
  | "about"
  | "blog"
  | "docs"
  | "customers"
  | "contact"
  | "other";

export interface CompetitorIntelligence {
  positioning?: string;
  targetAudience?: string;
  keyFeatures?: string[];
  keyBenefits?: string[];
  pricingSignal?: string;
  ctaPattern?: string;
  socialLinks?: string[];
  repeatedTerms?: string[];
  contentThemes?: string[];
}

export interface DeepEnrichmentResult {
  status: DeepEnrichStatus;
  error: string | null;
  baseUrl: string;
  crawledAt: string;
  pages: CompetitorPageEnrichment[];
  consolidated: CompetitorIntelligence | null;
}

const DEEP_ENRICH_SOURCE_TYPES = new Set([
  "competitor_homepage",
  "competitor_pricing",
  "competitor_blog",
  "marketplace",
  "documentation",
]);

const HIGH_VALUE_PATHS = [
  { path: "/pricing", type: "pricing" as CompetitorPageType },
  { path: "/plans", type: "pricing" as CompetitorPageType },
  { path: "/features", type: "features" as CompetitorPageType },
  { path: "/product", type: "product" as CompetitorPageType },
  { path: "/about", type: "about" as CompetitorPageType },
  { path: "/blog", type: "blog" as CompetitorPageType },
  { path: "/docs", type: "docs" as CompetitorPageType },
  { path: "/documentation", type: "docs" as CompetitorPageType },
  { path: "/customers", type: "customers" as CompetitorPageType },
  { path: "/case-studies", type: "customers" as CompetitorPageType },
  { path: "/contact", type: "contact" as CompetitorPageType },
];

const MAX_PAGES_PER_SOURCE = 4;
const MAX_PAGE_BODY_CHARS = 8_000;

export function shouldDeepEnrich(sourceType: string, relevanceScore: number): boolean {
  if (!DEEP_ENRICH_SOURCE_TYPES.has(sourceType)) return false;
  return relevanceScore >= 0.55;
}

export function discoverCompetitorPages(baseUrl: string): Array<{ url: string; type: CompetitorPageType }> {
  const discovered: Array<{ url: string; type: CompetitorPageType }> = [];

  try {
    const base = new URL(baseUrl);
    const basePath = base.pathname.replace(/\/+$/, "");

    // Include homepage as first page (highest priority)
    const baseCanonical = canonicalizeUrl(baseUrl);
    discovered.push({ url: baseUrl, type: "homepage" });

    for (const { path, type } of HIGH_VALUE_PATHS) {
      const candidate = new URL(path, base).toString();
      const canonical = canonicalizeUrl(candidate);

      // Skip if same as base URL
      if (canonical === baseCanonical) continue;
      // Skip if already in list
      if (discovered.some((d) => canonicalizeUrl(d.url) === canonical)) continue;

      discovered.push({ url: candidate, type });
    }
  } catch {
    return [];
  }

  return discovered.slice(0, MAX_PAGES_PER_SOURCE);
}

export function inferPageTypeFromUrl(url: string): CompetitorPageType {
  const lower = url.toLowerCase();
  for (const { path, type } of HIGH_VALUE_PATHS) {
    if (lower.includes(path.toLowerCase())) return type;
  }
  return "other";
}

export function extractSocialLinks(html: string | null): string[] {
  if (!html) return [];
  const links: string[] = [];
  const patterns = [
    /href="(https?:\/\/(?:twitter\.com|x\.com)\/[^"]+)"/gi,
    /href="(https?:\/\/linkedin\.com\/[^"]+)"/gi,
    /href="(https?:\/\/youtube\.com\/[^"]+)"/gi,
    /href="(https?:\/\/(?:instagram|tiktok|facebook|reddit)\.com\/[^"]+)"/gi,
  ];

  for (const pattern of patterns) {
    let match;
    while ((match = pattern.exec(html)) !== null) {
      const url = match[1].replace(/&amp;/g, "&");
      if (!links.includes(url)) links.push(url);
    }
  }

  return links.slice(0, 8);
}

export function extractPricingSignal(text: string): string | undefined {
  const lower = text.toLowerCase();
  const patterns = [
    /\$\d+(?:\/mo|\/month|\/yr|\/year)?/i,
    /\bdollars?\b.*\bmonth\b/i,
    /\bfree\b.*\btrial\b/i,
    /\b(enterprise|pro|starter|basic|premium)\b.*\b(plan|tier)\b/i,
    /\b(per seat|per user|monthly|annually)\b/i,
  ];

  for (const pattern of patterns) {
    const match = lower.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

export function extractCtaPattern(text: string, headings: string[]): string | undefined {
  const combined = `${text} ${headings.join(" ")}`.toLowerCase();
  const patterns = [
    /\b(get started|start free|sign up|try now|request demo|book a call|contact sales)\b/i,
    /\b(join|subscribe|download|install|buy now|get access)\b/i,
    /\b(early access|join waitlist|get notified|join beta)\b/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match) return match[0];
  }
  return undefined;
}

function extractRepeatedTerms(text: string): string[] {
  const words = text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 4 && !STOP_WORDS.has(w));

  const counts = new Map<string, number>();
  for (const word of words) {
    counts.set(word, (counts.get(word) ?? 0) + 1);
  }

  return [...counts.entries()]
    .filter(([, count]) => count >= 3)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([word]) => word);
}

const STOP_WORDS = new Set([
  "about", "after", "also", "been", "before", "being", "between", "could", "does",
  "from", "have", "into", "more", "other", "should", "that", "their", "there",
  "these", "they", "this", "through", "under", "very", "what", "when", "where",
  "which", "while", "with", "would", "your", "click", "here", "learn", "more",
]);

async function crawlCompetitorPage(
  url: string,
  expectedType: CompetitorPageType
): Promise<CompetitorPageEnrichment> {
  const result: CompetitorPageEnrichment = {
    url,
    pageType: expectedType,
    status: "failed",
    title: null,
    headings: [],
    ctas: [],
    bodyTextPreview: "",
    extracted: null,
  };

  try {
    await assertSafePublicHttpUrl(url);
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Unsafe URL";
    return result;
  }

  try {
    const page = await extractPage({ url, allowFirecrawl: false });

    if (page.fetchStatus !== "success") {
      result.error = page.error ?? "Fetch failed";
      return result;
    }

    result.status = "success";
    result.title = page.title;
    result.headings = page.headings.slice(0, 15);
    result.ctas = page.ctas.slice(0, 8);
    result.bodyTextPreview = page.bodyText.slice(0, MAX_PAGE_BODY_CHARS);

    const socialLinks = extractSocialLinks(page.html);
    const pricingSignal = extractPricingSignal(page.bodyText);
    const ctaPattern = extractCtaPattern(page.bodyText, page.ctas);
    const repeatedTerms = extractRepeatedTerms(page.bodyText);

    const contentThemes: string[] = [];
    if (pricingSignal) contentThemes.push("pricing");
    if (ctaPattern?.includes("demo") || ctaPattern?.includes("contact sales")) {
      contentThemes.push("sales-led");
    } else if (ctaPattern?.includes("free") || ctaPattern?.includes("trial")) {
      contentThemes.push("product-led");
    }
    if (page.headings.some((h) => /case stud|testimonial|customer/i.test(h))) {
      contentThemes.push("social-proof");
    }
    if (page.headings.some((h) => /api|integration|developer/i.test(h))) {
      contentThemes.push("developer-focused");
    }

    result.extracted = {
      positioning: page.description ?? undefined,
      pricingSignal,
      ctaPattern,
      socialLinks,
      repeatedTerms,
      contentThemes,
      keyFeatures: page.headings
        .filter((h) => /feature|capability|benefit|solution/i.test(h))
        .slice(0, 5),
      keyBenefits: page.headings
        .filter((h) => /benefit|advantage|why|value/i.test(h))
        .slice(0, 5),
    };

    if (expectedType === "homepage" && !result.extracted.positioning) {
      result.extracted.positioning = inferPositioningFromHeadings(page.headings);
    }
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Crawl failed";
  }

  return result;
}

function inferPositioningFromHeadings(headings: string[]): string | undefined {
  const combined = headings.join(" ").toLowerCase();

  const patterns = [
    /(?:the|a|an)\s+(\w+\s+)?(?:platform|tool|solution|software|service)\s+(?:for|that|to)\s+([^\.]+)/i,
    /(?:helps?|enables?|lets?|allows?)\s+([^\.]+)/i,
    /([^\.]{10,80})\s+(?:made simple|made easy|without|no code|automation)/i,
  ];

  for (const pattern of patterns) {
    const match = combined.match(pattern);
    if (match) return match[0].trim();
  }

  return headings.find((h) => h.length > 20 && h.length < 100);
}

export function consolidateIntelligence(pages: CompetitorPageEnrichment[]): CompetitorIntelligence | null {
  const successful = pages.filter((p) => p.status === "success" && p.extracted);
  if (!successful.length) return null;

  const consolidated: CompetitorIntelligence = {};

  const positionings = successful.map((p) => p.extracted?.positioning).filter(Boolean) as string[];
  if (positionings.length) consolidated.positioning = positionings[0];

  const audiences = successful
    .map((p) => p.extracted?.targetAudience)
    .filter(Boolean) as string[];
  if (audiences.length) consolidated.targetAudience = audiences[0];

  const allFeatures = new Set<string>();
  const allBenefits = new Set<string>();
  const allThemes = new Set<string>();
  const allTerms = new Map<string, number>();
  const allSocial = new Set<string>();
  const pricingSignals: string[] = [];
  const ctaPatterns: string[] = [];

  for (const page of successful) {
    const ex = page.extracted!;
    ex.keyFeatures?.forEach((f) => allFeatures.add(f));
    ex.keyBenefits?.forEach((b) => allBenefits.add(b));
    ex.contentThemes?.forEach((t) => allThemes.add(t));
    ex.socialLinks?.forEach((s) => allSocial.add(s));
    if (ex.pricingSignal) pricingSignals.push(ex.pricingSignal);
    if (ex.ctaPattern) ctaPatterns.push(ex.ctaPattern);

    ex.repeatedTerms?.forEach((term) => {
      allTerms.set(term, (allTerms.get(term) ?? 0) + 1);
    });
  }

  if (allFeatures.size) consolidated.keyFeatures = [...allFeatures].slice(0, 8);
  if (allBenefits.size) consolidated.keyBenefits = [...allBenefits].slice(0, 8);
  if (allThemes.size) consolidated.contentThemes = [...allThemes];
  if (allSocial.size) consolidated.socialLinks = [...allSocial].slice(0, 8);
  if (pricingSignals.length) consolidated.pricingSignal = pricingSignals[0];
  if (ctaPatterns.length) consolidated.ctaPattern = ctaPatterns[0];

  consolidated.repeatedTerms = [...allTerms.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([term]) => term);

  return consolidated;
}

export async function deepEnrichSource(
  baseUrl: string,
  sourceType: string,
  options?: { maxPages?: number; concurrent?: boolean }
): Promise<DeepEnrichmentResult> {
  const maxPages = options?.maxPages ?? MAX_PAGES_PER_SOURCE;

  const result: DeepEnrichmentResult = {
    status: "enriching",
    error: null,
    baseUrl,
    crawledAt: new Date().toISOString(),
    pages: [],
    consolidated: null,
  };

  try {
    const base = new URL(baseUrl);
    if (!(await isSafeHostname(base.hostname))) {
      result.status = "failed";
      result.error = "Unsafe hostname for deep enrichment";
      return result;
    }
  } catch {
    result.status = "failed";
    result.error = "Invalid URL";
    return result;
  }

  const discovered = discoverCompetitorPages(baseUrl).slice(0, maxPages);

  if (!discovered.length) {
    result.status = "skipped";
    return result;
  }

  const crawled: CompetitorPageEnrichment[] = [];

  for (const { url, type } of discovered) {
    const page = await crawlCompetitorPage(url, type);
    crawled.push(page);
  }

  result.pages = crawled;
  result.consolidated = consolidateIntelligence(crawled);
  result.status = crawled.some((p) => p.status === "success") ? "enriched" : "failed";

  if (result.status === "failed" && crawled.every((p) => p.status === "failed")) {
    result.error = "All pages failed to enrich";
  }

  return result;
}

export async function deepEnrichCandidate(
  candidate: { url: string; sourceType: string; relevanceScore: number }
): Promise<DeepEnrichmentResult | null> {
  if (!shouldDeepEnrich(candidate.sourceType, candidate.relevanceScore)) {
    return null;
  }

  return deepEnrichSource(candidate.url, candidate.sourceType);
}
