import { cleanText, decodeHtml, extractBodyText, extractPageMeta } from "../adapters/html-utils";
import { safeFetchHtml } from "@/services/trendwatch/ingestion";
import { VideoEvidenceSchema, type VideoEvidence } from "./schema";
import { inspectVideoUrl } from "./video-url";

const CTA_PHRASES = [
  "get started", "try free", "link in bio", "download", "join waitlist", "book demo",
  "comment below", "follow for", "visit", "sign up", "contact sales",
];

const FORMAT_RULES: Array<[VideoEvidence["formatGuess"], RegExp]> = [
  ["before_after", /\bbefore\s*(?:and|&|\/|→|to)\s*after\b/i],
  ["transformation", /\btransformation|from .{1,50} to\b/i],
  ["tutorial", /\bhow to|tutorial|step[- ]by[- ]step|walkthrough\b/i],
  ["teardown", /\bteardown|roast|audit(?:ing)?\b/i],
  ["comparison", /\bversus|\bvs\.?\b|compare|comparison\b/i],
  ["founder_story", /\bmy startup|our startup|as a founder|founder story|how (?:i|we) built\b/i],
  ["reaction", /\breaction|reacting to|duet|stitch\b/i],
  ["listicle", /(?:^|\s)(?:\d+|three|four|five|six|seven|eight|nine|ten)\s+(?:ways|tips|things|mistakes|ideas|tools)\b/i],
  ["demo", /\bdemo|watch (?:me|this)|in action|here'?s how it works\b/i],
  ["product_showcase", /\bintroducing|product showcase|new feature|we (?:built|launched|shipped)\b/i],
];

export function extractHashtags(text: string): string[] {
  const seen = new Set<string>();
  for (const match of text.matchAll(/(^|\s)#([\p{L}\p{N}_]{2,50})/gu)) {
    seen.add(`#${match[2]?.toLowerCase()}`);
    if (seen.size >= 30) break;
  }
  return [...seen];
}

export function extractLinkedUrls(text: string, html = ""): string[] {
  const values = [
    ...[...text.matchAll(/https?:\/\/[^\s<>'"\])}]+/gi)].map((match) => match[0]),
    ...[...html.matchAll(/<a\b[^>]*href=["'](https?:\/\/[^"']+)["']/gi)].map((match) => decodeHtml(match[1] ?? "")),
  ];
  const output = new Set<string>();
  for (const value of values) {
    try {
      const url = new URL(value.replace(/[.,;:!?]+$/, ""));
      if (["http:", "https:"].includes(url.protocol)) {
        url.hash = "";
        output.add(url.toString());
      }
    } catch {
      // Ignore malformed visible URLs.
    }
    if (output.size >= 30) break;
  }
  return [...output];
}

export function detectCTA(text: string): string | null {
  const normalized = text.replace(/\s+/g, " ").trim();
  const lower = normalized.toLowerCase();
  let best: { phrase: string; index: number } | null = null;
  for (const phrase of CTA_PHRASES) {
    const index = lower.indexOf(phrase);
    if (index >= 0 && (!best || index < best.index)) best = { phrase, index };
  }
  if (!best) return null;
  const start = Math.max(0, normalized.lastIndexOf(".", best.index) + 1);
  const endMatch = normalized.slice(best.index).match(/[.!?]/);
  const end = endMatch?.index == null ? Math.min(normalized.length, start + 180) : best.index + endMatch.index + 1;
  return normalized.slice(start, end).trim().slice(0, 180) || best.phrase;
}

export function extractHook(text: string): string | null {
  const normalized = cleanText(text).replace(/\n+/g, " ").trim();
  if (!normalized) return null;
  const first = normalized.split(/(?<=[.!?])\s+|\s+[|•]\s+/)[0]?.trim() ?? "";
  return first.slice(0, 220) || null;
}

export function guessVideoFormat(text: string): VideoEvidence["formatGuess"] {
  for (const [format, pattern] of FORMAT_RULES) {
    if (pattern.test(text)) return format;
  }
  return "unknown";
}

export function parseMetric(value: string): number | null {
  const match = value.trim().match(/^([0-9]+(?:[.,][0-9]+)?)\s*([kmb])?$/i);
  if (!match) return null;
  const rawNumber = match[1] ?? "";
  const separator = rawNumber.match(/[.,](\d+)$/);
  const normalized = !match[2] && separator?.[1]?.length === 3
    ? rawNumber.replace(/[.,]/g, "")
    : rawNumber.replace(",", ".");
  const number = Number(normalized);
  if (!Number.isFinite(number) || number < 0) return null;
  const multiplier = match[2]?.toLowerCase() === "k" ? 1_000 : match[2]?.toLowerCase() === "m" ? 1_000_000 : match[2]?.toLowerCase() === "b" ? 1_000_000_000 : 1;
  return Math.round(number * multiplier);
}

export type EngagementMetricLabel = "views" | "likes" | "comments" | "shares" | "saves";

export function extractVisibleMetric(text: string, label: EngagementMetricLabel): number | null {
  const escaped = label.replace(/s$/, "s?");
  const patterns = [
    new RegExp(`(?:^|[^\\w])([0-9]+(?:[.,][0-9]+)?\\s*[KMB]?)\\s+${escaped}(?:[^\\w]|$)`, "i"),
    new RegExp(`${escaped}\\s*[:·-]\\s*([0-9]+(?:[.,][0-9]+)?\\s*[KMB]?)(?:[^\\w]|$)`, "i"),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return parseMetric(match[1].replace(/\s+/g, ""));
  }
  return null;
}

export interface EngagementProxies {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}

export function extractEngagementFromText(text: string): EngagementProxies {
  return {
    views: extractVisibleMetric(text, "views"),
    likes: extractVisibleMetric(text, "likes"),
    comments: extractVisibleMetric(text, "comments"),
    shares: extractVisibleMetric(text, "shares"),
    saves: extractVisibleMetric(text, "saves"),
  };
}

export function extractVisibleFollowerCount(text: string): number | null {
  const patterns = [
    /(?:^|[^\w])([0-9]+(?:[.,][0-9]+)?\s*[KMB]?)\s+followers?(?:[^\w]|$)/i,
    /followers?\s*[:·-]\s*([0-9]+(?:[.,][0-9]+)?\s*[KMB]?)(?:[^\w]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (match?.[1]) return parseMetric(match[1].replace(/\s+/g, ""));
  }
  return null;
}

export async function extractVideoEvidence(url: string): Promise<VideoEvidence> {
  const info = inspectVideoUrl(url);
  const base = {
    projectId: null,
    competitorId: null,
    sourceCandidateId: null,
    platform: info.platform,
    videoUrl: url,
    canonicalUrl: info.canonicalUrl,
    accountHandle: info.accountHandle,
    accountUrl: info.accountUrl,
    caption: null,
    title: null,
    hashtags: [],
    sound: null,
    durationSeconds: null,
    viewCount: null,
    likeCount: null,
    commentCount: null,
    shareCount: null,
    postedAt: null,
    linkedUrls: [],
    detectedHook: null,
    detectedCTA: null,
    formatGuess: "unknown" as const,
    topicGuess: null,
    sourceConfidence: 0,
    fetchStatus: "failed" as const,
    fetchMethod: "safe_public_html",
    rawSourceType: info.sourceType,
    metadata: {},
  };

  if (info.platform === "other" || info.sourceType === "unknown") {
    return VideoEvidenceSchema.parse({ ...base, metadata: { error: "Unsupported public video or profile URL." } });
  }

  const fetched = await safeFetchHtml(info.canonicalUrl);
  if (!fetched.ok || !fetched.html) {
    return VideoEvidenceSchema.parse({
      ...base,
      canonicalUrl: inspectVideoUrl(fetched.finalUrl).canonicalUrl,
      metadata: { error: fetched.error ?? "Public page could not be fetched.", final_url: fetched.finalUrl },
    });
  }

  const html = fetched.html;
  const meta = extractPageMeta(html);
  const ogTitle = metaContent(html, "og:title");
  const ogDescription = metaContent(html, "og:description") ?? meta.description;
  const title = cleanNullable(ogTitle ?? meta.title);
  const caption = cleanNullable(ogDescription);
  const visibleText = [title, caption, extractBodyText(html, 8_000)].filter(Boolean).join("\n");
  const hashtags = extractHashtags(visibleText);
  const postedAt = extractDate(html);
  const durationSeconds = extractDurationSeconds(html);
  const followerCount = extractVisibleFollowerCount(visibleText);

  return VideoEvidenceSchema.parse({
    ...base,
    canonicalUrl: inspectVideoUrl(fetched.finalUrl).canonicalUrl,
    title,
    caption,
    hashtags,
    durationSeconds,
    followerCount,
    viewCount: extractVisibleMetric(visibleText, "views"),
    likeCount: extractVisibleMetric(visibleText, "likes"),
    commentCount: extractVisibleMetric(visibleText, "comments"),
    shareCount: extractVisibleMetric(visibleText, "shares"),
    postedAt,
    linkedUrls: extractLinkedUrls(visibleText, html).filter((linked) => linked !== info.canonicalUrl),
    detectedHook: extractHook(caption ?? title ?? ""),
    detectedCTA: detectCTA(visibleText),
    formatGuess: guessVideoFormat(visibleText),
    topicGuess: hashtags[0]?.slice(1) ?? null,
    fetchStatus: "success",
    metadata: { final_url: fetched.finalUrl, content_type: fetched.contentType },
  });
}

function metaContent(html: string, property: string): string | null {
  const escaped = property.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["']`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["']`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return decodeHtml(match[1]);
  }
  return null;
}

function cleanNullable(value: string | null | undefined): string | null {
  if (!value) return null;
  const cleaned = cleanText(value).slice(0, 10_000);
  return cleaned || null;
}

function extractDate(html: string): string | null {
  const match = html.match(/["'](?:uploadDate|datePublished|createTime)["']\s*:\s*["']([^"']+)["']/i);
  if (!match?.[1]) return null;
  const date = new Date(/^\d{10}$/.test(match[1]) ? Number(match[1]) * 1_000 : match[1]);
  return Number.isNaN(date.valueOf()) ? null : date.toISOString();
}

function extractDurationSeconds(html: string): number | null {
  const match = html.match(/["']duration["']\s*:\s*["']PT(?:(\d+)M)?(?:(\d+)S)?["']/i);
  if (!match) return null;
  return Number(match[1] ?? 0) * 60 + Number(match[2] ?? 0);
}
