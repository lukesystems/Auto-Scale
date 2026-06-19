const JUNK_LINES = new Set([
  "privacy policy",
  "terms of service",
  "all rights reserved",
  "cookie policy",
  "accept cookies",
  "sign in",
  "log in",
]);

export function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&nbsp;/gi, " ");
}

export function stripTags(value: string): string {
  return decodeHtml(value.replace(/<[^>]+>/g, " "));
}

export function cleanText(value: string): string {
  return decodeHtml(value)
    .split(/\n| {2,}/)
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean)
    .filter((line, index, lines) => lines.indexOf(line) === index)
    .filter((line) => !JUNK_LINES.has(line.toLowerCase()))
    .join("\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function firstMatch(html: string, pattern: RegExp): string | null {
  const match = html.match(pattern);
  return match?.[1] ? decodeHtml(match[1]) : null;
}

export function htmlToMarkdown(html: string): string {
  let body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  body = body
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, "")
    .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, "");

  const lines: string[] = [];

  for (const match of body.matchAll(/<h([1-3])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const level = Number(match[1]);
    const text = cleanText(stripTags(match[2] ?? ""));
    if (text) lines.push(`${"#".repeat(level)} ${text}`);
  }

  for (const match of body.matchAll(/<li\b[^>]*>([\s\S]*?)<\/li>/gi)) {
    const text = cleanText(stripTags(match[1] ?? ""));
    if (text) lines.push(`- ${text}`);
  }

  const paragraphs = body
    .replace(/<h[1-6][^>]*>[\s\S]*?<\/h[1-6]>/gi, "\n")
    .replace(/<li\b[^>]*>[\s\S]*?<\/li>/gi, "\n")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ");

  const paragraphText = cleanText(stripTags(paragraphs));
  if (paragraphText) lines.push(paragraphText);

  return cleanText(lines.join("\n\n")).slice(0, 20_000);
}

export function extractHeadings(html: string, limit = 40): string[] {
  return [...html.matchAll(/<h[1-3]\b[^>]*>([\s\S]*?)<\/h[1-3]>/gi)]
    .map((match) => cleanText(stripTags(match[1] ?? "")))
    .filter(Boolean)
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, limit);
}

export function extractCtas(html: string, limit = 30): string[] {
  return [...html.matchAll(/<(?:button|a)\b[^>]*>([\s\S]*?)<\/(?:button|a)>/gi)]
    .map((match) => cleanText(stripTags(match[1] ?? "")))
    .filter((text) => text.length >= 2 && text.length <= 80)
    .filter((text) => /\b(start|try|get|book|join|sign|create|generate|demo|contact|buy|subscribe|learn)\b/i.test(text))
    .filter((value, index, array) => array.indexOf(value) === index)
    .slice(0, limit);
}

export function extractBodyText(html: string, limit = 12_000): string {
  const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
  return cleanText(
    stripTags(
      body
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, " ")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, " ")
        .replace(/<noscript[^>]*>[\s\S]*?<\/noscript>/gi, " ")
        .replace(/<svg[^>]*>[\s\S]*?<\/svg>/gi, " ")
    )
  ).slice(0, limit);
}

export function extractPageMeta(html: string): { title: string | null; description: string | null } {
  const title = firstMatch(html, /<title[^>]*>([\s\S]*?)<\/title>/i);
  const description =
    firstMatch(html, /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
    firstMatch(html, /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
    firstMatch(html, /<meta[^>]+content=["']([^"']+)["'][^>]+(?:name=["']description["']|property=["']og:description["'])/i);

  return {
    title: title ? cleanText(title) : null,
    description: description ? cleanText(description) : null,
  };
}

export function needsBrowserRender(html: string | null, bodyText: string): boolean {
  if (!html) return true;
  const lower = html.toLowerCase();
  const spaSignals =
    lower.includes("__next_data__") ||
    lower.includes("id=\"root\"") ||
    lower.includes("id='root'") ||
    lower.includes("ng-app") ||
    lower.includes("data-reactroot");
  return bodyText.length < 200 && spaSignals;
}
