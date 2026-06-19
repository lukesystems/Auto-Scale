import type { CrawledPageContent, ProductPageType } from "../types";

const PAGE_TYPE_RULES: Array<{ type: ProductPageType; patterns: RegExp[] }> = [
  { type: "pricing", patterns: [/\/pricing\b/i, /\/plans\b/i, /\/buy\b/i] },
  { type: "features", patterns: [/\/features\b/i, /\/capabilities\b/i] },
  { type: "product", patterns: [/\/product\b/i, /\/platform\b/i, /\/how-it-works\b/i] },
  { type: "about", patterns: [/\/about\b/i, /\/company\b/i, /\/team\b/i, /\/story\b/i] },
  { type: "solutions", patterns: [/\/solutions\b/i, /\/use-cases\b/i, /\/industries\b/i] },
  { type: "customers", patterns: [/\/customers\b/i, /\/case-stud/i, /\/testimonials\b/i] },
  { type: "docs", patterns: [/\/docs\b/i, /\/documentation\b/i, /\/api\b/i] },
  { type: "blog", patterns: [/\/blog\b/i, /\/articles\b/i, /\/resources\b/i] },
  { type: "contact", patterns: [/\/contact\b/i, /\/support\b/i] },
  { type: "legal", patterns: [/\/privacy\b/i, /\/terms\b/i, /\/legal\b/i, /\/cookies\b/i] },
];

export function classifyPage(page: CrawledPageContent, isHomepage = false): ProductPageType {
  if (isHomepage) return "home";

  const path = safePathname(page.finalUrl || page.url).toLowerCase();
  const haystack = `${path} ${page.title ?? ""} ${page.headings.join(" ")}`.toLowerCase();

  for (const rule of PAGE_TYPE_RULES) {
    if (rule.patterns.some((pattern) => pattern.test(path) || pattern.test(haystack))) {
      return rule.type;
    }
  }

  if (path === "/" || path === "") return "home";
  return "other";
}

function safePathname(url: string): string {
  try {
    return new URL(url).pathname;
  } catch {
    return url;
  }
}
