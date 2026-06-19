import { safeFetchHtml } from "@/services/trendwatch/ingestion";

export { safeFetchUrl, type SafeFetchResult } from "@/services/trendwatch/ingestion";

const MAX_PAGES = 5;
const MAX_TOTAL_TEXT = 35_000;
const IMPORTANT_PATH_TERMS = ["pricing", "features", "product", "about", "solutions", "customers"];

export interface SiteFetchInput {
  url: string;
}

export interface ExtractedPage {
  url: string;
  title: string | null;
  description: string | null;
  headings: string[];
  ctas: string[];
  bodyText: string;
}

export interface SiteFetchOutput {
  ok: boolean;
  url: string;
  finalUrl: string | null;
  title: string | null;
  description: string | null;
  textSnippet: string | null;
  pages: ExtractedPage[];
  error: string | null;
}

export async function fetchSiteForAutoBrief(input: SiteFetchInput): Promise<SiteFetchOutput> {
  const normalizedUrl = normalizeProductUrl(input.url);
  const homepage = await fetchAndExtract(normalizedUrl);

  if (!homepage.ok || !homepage.page) {
    return {
      ok: false,
      url: normalizedUrl,
      finalUrl: homepage.finalUrl,
      title: null,
      description: null,
      textSnippet: null,
      pages: [],
      error: homepage.error ?? "Website could not be read.",
    };
  }

  const discovered = discoverImportantPages(homepage.page, homepage.html ?? "").slice(0, MAX_PAGES - 1);
  const pages: ExtractedPage[] = [homepage.page];
  const seen = new Set([new URL(homepage.page.url).toString()]);

  const uniqueDiscovered = discovered
    .map((url) => new URL(url).toString())
    .filter((url) => {
      if (seen.has(url)) return false;
      seen.add(url);
      return true;
    });

  const extraPages = await Promise.all(uniqueDiscovered.map((url) => fetchAndExtract(url)));
  for (const next of extraPages) {
    if (pages.length >= MAX_PAGES) break;
    if (next.ok && next.page) pages.push(next.page);
  }

  const combined = cleanText(
    pages
      .map((page) => [
        `URL: ${page.url}`,
        page.title ? `Title: ${page.title}` : "",
        page.description ? `Description: ${page.description}` : "",
        page.headings.length ? `Headings: ${page.headings.join(" | ")}` : "",
        page.ctas.length ? `CTAs: ${page.ctas.join(" | ")}` : "",
        page.bodyText,
      ].filter(Boolean).join("\n"))
      .join("\n\n---\n\n")
  ).slice(0, MAX_TOTAL_TEXT);

  return {
    ok: combined.length >= 300,
    url: normalizedUrl,
    finalUrl: homepage.page.url,
    title: homepage.page.title,
    description: homepage.page.description,
    textSnippet: combined || null,
    pages,
    error: combined.length >= 300 ? null : "Website returned too little readable product copy.",
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

async function fetchAndExtract(url: string): Promise<{
  ok: boolean;
  finalUrl: string | null;
  html: string | null;
  page: ExtractedPage | null;
  error: string | null;
}> {
  const fetched = await safeFetchHtml(url);
  if (!fetched.ok || !fetched.html) {
    return { ok: false, finalUrl: fetched.finalUrl, html: null, page: null, error: fetched.error };
  }

  return {
    ok: true,
    finalUrl: fetched.finalUrl,
    html: fetched.html,
    page: extractPage(fetched.finalUrl, fetched.html),
    error: null,
  };
}

function discoverImportantPages(homepage: ExtractedPage, html: string): string[] {
  const base = new URL(homepage.url);
  const matches = [...html.matchAll(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi)];
  const candidates = matches
    .map((match) => {
      try {
        const url = new URL(decodeHtml(match[1] ?? ""), base);
        url.hash = "";
        return {
          url,
          text: stripTags(match[2] ?? "").toLowerCase(),
          path: url.pathname.toLowerCase(),
        };
      } catch {
        return null;
      }
    })
    .filter((item): item is { url: URL; text: string; path: string } => Boolean(item))
    .filter((item) => item.url.origin === base.origin)
    .filter((item) => IMPORTANT_PATH_TERMS.some((term) => item.path.includes(term) || item.text.includes(term)))
    .sort((a, b) => scoreImportantLink(b) - scoreImportantLink(a));

  return candidates.map((item) => item.url.toString());
}

function scoreImportantLink(item: { text: string; path: string }): number {
  return IMPORTANT_PATH_TERMS.reduce((score, term, index) => {
    const weight = IMPORTANT_PATH_TERMS.length - index;
    return score + (item.path.includes(term) ? weight * 2 : 0) + (item.text.includes(term) ? weight : 0);
  }, 0);
}

function extractPage(url: string, html: string): ExtractedPage {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name=["']description["']|property=["']og:description["'])/i);

  const headings = [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => cleanText(stripTags(match[1] ?? "")))
    .filter(Boolean)
    .slice(0, 40);

  const ctas = [...html.matchAll(/<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
    .map((match) => cleanText(stripTags(match[1] ?? "")))
    .filter((text) => text.length >= 2 && text.length <= 80)
    .filter((text) => /\b(start|try|get|book|join|sign|create|generate|demo|contact|buy|subscribe|learn)\b/i.test(text))
    .filter(unique)
    .slice(0, 30);

  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  const bodyText = cleanText(
    stripTags(
      body
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, " ")
    )
  ).slice(0, 12_000);

  return {
    url,
    title: title ? cleanText(title) : null,
    description: description ? cleanText(description) : null,
    headings,
    ctas,
    bodyText,
  };
}

function firstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

function cleanText(value: string): string {
  const junk = [
    "privacy policy",
    "terms of service",
    "all rights reserved",
    "cookie policy",
    "accept cookies",
    "sign in",
    "log in",
  ];

  return decodeHtml(value)
    .split(/\n| {2,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .filter((line) => !junk.includes(line.toLowerCase()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

function unique(value: string, index: number, array: string[]): boolean {
  return array.indexOf(value) === index;
}
