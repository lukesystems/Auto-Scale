export { safeFetchUrl, type SafeFetchResult } from "@/services/trendwatch/ingestion";

export interface SiteFetchInput {
  url: string;
}

export interface SiteFetchOutput {
  ok: boolean;
  url: string;
  title: string | null;
  description: string | null;
  textSnippet: string | null;
  error: string | null;
}

export async function fetchSiteForAutoBrief(input: SiteFetchInput): Promise<SiteFetchOutput> {
  const { safeFetchUrl } = await import("@/services/trendwatch/ingestion");
  const result = await safeFetchUrl(normalizeUrl(input.url));

  return {
    ok: result.status === "success",
    url: result.url,
    title: result.title,
    description: result.description,
    textSnippet: result.textSnippet,
    error: result.error,
  };
}

function normalizeUrl(raw: string): string {
  const trimmed = raw.trim();
  if (!trimmed) return trimmed;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}
