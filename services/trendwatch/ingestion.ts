import dns from "node:dns/promises";
import net from "node:net";

const MAX_BODY_BYTES = 1024 * 1024;
const MAX_REDIRECTS = 3;
const REQUEST_TIMEOUT_MS = 25_000;
const FETCH_RETRY_STATUSES = new Set([429, 503]);
const FETCH_MAX_ATTEMPTS = 4;
const DEFAULT_FETCH_HEADERS = {
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36",
  Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
  "Accept-Language": "en-US,en;q=0.9",
};

export interface SafeFetchResult {
  url: string;
  finalUrl: string;
  title: string | null;
  description: string | null;
  textSnippet: string | null;
  platform: string;
  status: "success" | "failed";
  error: string | null;
}

export interface SafeFetchHtmlResult {
  ok: boolean;
  url: string;
  finalUrl: string;
  html: string | null;
  contentType: string | null;
  error: string | null;
}

function isPrivateIpv4(ip: string): boolean {
  const [a, b] = ip.split(".").map(Number);
  return (
    a === 0 ||
    a === 10 ||
    a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 0) ||
    (a === 192 && b === 168) ||
    (a === 198 && (b === 18 || b === 19)) ||
    a >= 224
  );
}

export function isPrivateIp(ip: string): boolean {
  let normalized = ip.toLowerCase().split("%")[0];
  const version = net.isIP(normalized);
  if (!version) return true;
  if (version === 4) return isPrivateIpv4(normalized);

  try {
    normalized = new URL(`http://[${normalized}]/`).hostname.slice(1, -1);
  } catch {
    return true;
  }
  if (normalized === "::" || normalized === "::1") return true;
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true;
  if (/^fe[89ab]/.test(normalized)) return true;
  if (normalized.startsWith("ff")) return true;

  const mapped = normalized.match(/^::ffff:(\d+\.\d+\.\d+\.\d+)$/);
  if (mapped) return isPrivateIpv4(mapped[1]);
  const mappedHex = normalized.match(/^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/);
  if (mappedHex) {
    const high = Number.parseInt(mappedHex[1], 16);
    const low = Number.parseInt(mappedHex[2], 16);
    return isPrivateIpv4(`${high >> 8}.${high & 255}.${low >> 8}.${low & 255}`);
  }
  return false;
}

export async function isSafeHostname(hostname: string): Promise<boolean> {
  const normalized = hostname.replace(/^\[|\]$/g, "");
  if (normalized === "localhost" || normalized.endsWith(".localhost")) return false;
  if (net.isIP(normalized)) return !isPrivateIp(normalized);

  try {
    const addresses = await dns.lookup(normalized, { all: true, verbatim: true });
    return addresses.length > 0 && addresses.every(({ address }) => !isPrivateIp(address));
  } catch {
    return false;
  }
}

export class UnsafeUrlError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UnsafeUrlError";
  }
}

/** Reject non-public HTTP(S) URLs before any adapter touches them. */
export async function assertSafePublicHttpUrl(urlStr: string): Promise<URL> {
  let url: URL;
  try {
    url = new URL(urlStr);
  } catch {
    throw new UnsafeUrlError(`Invalid URL: ${urlStr}`);
  }

  if (!["http:", "https:"].includes(url.protocol)) {
    throw new UnsafeUrlError(`Rejected protocol: ${url.protocol}`);
  }

  if (!(await isSafeHostname(url.hostname))) {
    throw new UnsafeUrlError(`SSRF prevention rejected hostname "${url.hostname}".`);
  }

  return url;
}

export function detectPlatform(url: string): string {
  const lower = url.toLowerCase();
  if (lower.includes("tiktok.com")) return "tiktok";
  if (lower.includes("instagram.com")) return "instagram";
  if (lower.includes("twitter.com") || lower.includes("x.com")) return "x";
  if (lower.includes("linkedin.com")) return "linkedin";
  if (lower.includes("youtube.com") || lower.includes("youtu.be")) return "youtube";
  if (lower.includes("threads.net")) return "threads";
  if (lower.includes("pinterest.com")) return "pinterest";
  if (lower.includes("reddit.com")) return "reddit";
  if (lower.includes("facebook.com")) return "facebook";
  return "other";
}

function decodeHtml(value: string): string {
  return value
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

async function readLimitedText(response: Response): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let bytesRead = 0;
  let output = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    const nextBytesRead = bytesRead + value.byteLength;
    if (nextBytesRead > MAX_BODY_BYTES) {
      const allowed = MAX_BODY_BYTES - bytesRead;
      if (allowed > 0) {
        output += decoder.decode(value.subarray(0, allowed), { stream: true });
      }
      await reader.cancel();
      break;
    }

    bytesRead = nextBytesRead;
    output += decoder.decode(value, { stream: true });
  }

  return output + decoder.decode();
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchOnce(current: URL): Promise<Response> {
  return fetch(current, {
    redirect: "manual",
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    headers: DEFAULT_FETCH_HEADERS,
  });
}

async function fetchWithValidatedRedirects(initialUrl: URL): Promise<{ response: Response; finalUrl: URL }> {
  let current = initialUrl;

  for (let redirectCount = 0; redirectCount <= MAX_REDIRECTS; redirectCount += 1) {
    if (!["http:", "https:"].includes(current.protocol)) {
      throw new Error(`Rejected protocol: ${current.protocol}`);
    }
    if (!(await isSafeHostname(current.hostname))) {
      throw new Error(`SSRF prevention rejected hostname "${current.hostname}".`);
    }

    const response = await fetchWithRetry(current);

    if (response.status < 300 || response.status >= 400) {
      return { response, finalUrl: current };
    }

    const location = response.headers.get("location");
    if (!location) throw new Error(`Redirect ${response.status} did not include a location.`);
    if (redirectCount === MAX_REDIRECTS) throw new Error("Source exceeded the redirect limit.");
    current = new URL(location, current);
  }

  throw new Error("Source exceeded the redirect limit.");
}

async function fetchWithRetry(current: URL): Promise<Response> {
  let lastResponse: Response | null = null;

  for (let attempt = 0; attempt < FETCH_MAX_ATTEMPTS; attempt += 1) {
    const response = await fetchOnce(current);
    lastResponse = response;

    if (!FETCH_RETRY_STATUSES.has(response.status) || attempt === FETCH_MAX_ATTEMPTS - 1) {
      return response;
    }

    const retryAfter = Number(response.headers.get("retry-after") ?? 0);
    const delayMs = retryAfter > 0 ? retryAfter * 1000 : [2000, 5000, 10000][attempt] ?? 10000;
    await sleep(delayMs);
  }

  return lastResponse!;
}

export async function safeFetchUrl(urlStr: string): Promise<SafeFetchResult> {
  const result: SafeFetchResult = {
    url: urlStr,
    finalUrl: urlStr,
    title: null,
    description: null,
    textSnippet: null,
    platform: detectPlatform(urlStr),
    status: "failed",
    error: null,
  };

  try {
    const { response, finalUrl } = await fetchWithValidatedRedirects(new URL(urlStr));
    result.finalUrl = finalUrl.toString();
    result.platform = detectPlatform(result.finalUrl);

    if (!response.ok) {
      result.error = `HTTP error ${response.status}: ${response.statusText}`;
      return result;
    }

    const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      result.error = `Unsupported content type: ${contentType || "unknown"}`;
      return result;
    }

    const html = await readLimitedText(response);
    const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descriptionMatch =
      html.match(/<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i) ??
      html.match(/<meta[^>]+content=["']([^"']+)["'][^>]+(?:name=["']description["']|property=["']og:description["'])/i);

    result.title = titleMatch ? decodeHtml(titleMatch[1].replace(/\s+/g, " ").trim()) : null;
    result.description = descriptionMatch ? decodeHtml(descriptionMatch[1].trim()) : null;

    const body = html.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? html;
    result.textSnippet = decodeHtml(
      body
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
        .replace(/<[^>]+>/g, " ")
        .replace(/\s+/g, " ")
        .trim()
    ).slice(0, 3_000);
    result.status = "success";
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Request failed.";
  }

  return result;
}

export async function safeFetchHtml(urlStr: string): Promise<SafeFetchHtmlResult> {
  const result: SafeFetchHtmlResult = {
    ok: false,
    url: urlStr,
    finalUrl: urlStr,
    html: null,
    contentType: null,
    error: null,
  };

  try {
    const { response, finalUrl } = await fetchWithValidatedRedirects(new URL(urlStr));
    result.finalUrl = finalUrl.toString();
    result.contentType = response.headers.get("content-type");

    if (!response.ok) {
      result.error = `HTTP error ${response.status}: ${response.statusText}`;
      return result;
    }

    const contentType = result.contentType?.toLowerCase() ?? "";
    if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
      result.error = `Unsupported content type: ${contentType || "unknown"}`;
      return result;
    }

    result.html = await readLimitedText(response);
    result.ok = true;
  } catch (error) {
    result.error = error instanceof Error ? error.message : "Request failed.";
  }

  return result;
}
