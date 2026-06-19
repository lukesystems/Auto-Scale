import { detectPlatform } from "@/services/trendwatch/ingestion";
import type { DiscoveryIntent } from "./schema";
import type { SearchResult } from "../types";

export interface NormalizedCandidate {
  url: string;
  canonicalUrl: string;
  title: string | null;
  snippet: string | null;
  platform: string;
  sourceType: string;
  adapter: string;
  discoveryQuery: string;
  discoveryReason: string;
  relevanceScore: number;
  accountHandle: string | null;
}

export function canonicalizeUrl(url: string): string {
  try {
    const parsed = new URL(url.trim());
    parsed.hash = "";
    parsed.hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (parsed.pathname.length > 1 && parsed.pathname.endsWith("/")) {
      parsed.pathname = parsed.pathname.slice(0, -1);
    }
    return parsed.toString();
  } catch {
    return url.trim().toLowerCase();
  }
}

export function extractAccountHandle(url: string, platform: string): string | null {
  try {
    const parsed = new URL(url);
    const parts = parsed.pathname.split("/").filter(Boolean);
    if (!parts.length) return null;

    if (platform === "x" || platform === "instagram" || platform === "tiktok" || platform === "threads") {
      const handle = parts[0]?.replace(/^@/, "");
      return handle && !["status", "p", "video", "reel"].includes(handle) ? handle : null;
    }
    if (platform === "youtube" && parts[0] === "@" && parts[1]) {
      return parts[1];
    }
    if (platform === "linkedin" && parts[0] === "in" && parts[1]) {
      return parts[1];
    }
    return null;
  } catch {
    return null;
  }
}

export function inferSourceType(url: string, intent: DiscoveryIntent): string {
  const lower = url.toLowerCase();
  if (lower.includes("reddit.com") || lower.includes("discourse.") || lower.includes("community.")) {
    return "community";
  }
  if (lower.includes("g2.com") || lower.includes("capterra") || lower.includes("trustpilot") || lower.includes("review")) {
    return "review";
  }
  if (lower.includes("vs") || lower.includes("alternative") || lower.includes("compare")) {
    return "comparison";
  }
  if (intent === "creator") return "creator";
  if (intent === "competitor" || intent === "indirect_competitor") return "competitor";
  if (intent === "community") return "community";
  if (lower.includes("youtube.com") || lower.includes("youtu.be") || lower.includes("tiktok.com")) {
    return "video";
  }
  if (lower.includes("medium.com") || lower.includes("/blog")) {
    return "article";
  }
  return "unknown";
}

export function normalizeSearchResults(input: {
  results: SearchResult[];
  adapter: string;
  query: string;
  reason: string;
  intent: DiscoveryIntent;
}): NormalizedCandidate[] {
  return input.results.map((result, index) => {
    const platform = detectPlatform(result.url);
    const canonicalUrl = canonicalizeUrl(result.url);
    return {
      url: result.url,
      canonicalUrl,
      title: result.title,
      snippet: result.snippet,
      platform,
      sourceType: inferSourceType(result.url, input.intent),
      adapter: input.adapter,
      discoveryQuery: input.query,
      discoveryReason: input.reason,
      relevanceScore: Math.max(0.1, 1 - index * 0.05),
      accountHandle: extractAccountHandle(result.url, platform),
    };
  });
}

function titleFingerprint(title: string | null): string | null {
  if (!title) return null;
  return title.toLowerCase().replace(/\s+/g, " ").trim().slice(0, 80);
}

export function dedupeCandidates(candidates: NormalizedCandidate[]): NormalizedCandidate[] {
  const byCanonical = new Map<string, NormalizedCandidate>();
  const byPlatformHandle = new Map<string, NormalizedCandidate>();
  const byTitle = new Map<string, NormalizedCandidate>();
  const output: NormalizedCandidate[] = [];

  for (const candidate of candidates) {
    const canonicalKey = candidate.canonicalUrl;
    if (byCanonical.has(canonicalKey)) continue;

    if (candidate.accountHandle) {
      const handleKey = `${candidate.platform}:${candidate.accountHandle.toLowerCase()}`;
      if (byPlatformHandle.has(handleKey)) continue;
    }

    const titleKey = titleFingerprint(candidate.title);
    if (titleKey && byTitle.has(titleKey)) continue;

    byCanonical.set(canonicalKey, candidate);
    if (candidate.accountHandle) {
      byPlatformHandle.set(`${candidate.platform}:${candidate.accountHandle.toLowerCase()}`, candidate);
    }
    if (titleKey) byTitle.set(titleKey, candidate);
    output.push(candidate);
  }

  return output;
}
