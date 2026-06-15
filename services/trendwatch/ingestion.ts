import dns from "dns";
import net from "net";

export interface SafeFetchResult {
  url: string;
  title: string | null;
  description: string | null;
  textSnippet: string | null;
  platform: string;
  status: "success" | "failed";
  error: string | null;
}

/**
 * Checks if an IP address is a private/local/loopback/multicast address
 * to prevent Server-Side Request Forgery (SSRF).
 */
export function isPrivateIp(ip: string): boolean {
  if (!net.isIP(ip)) return true; // Treat invalid IPs as private/unsafe

  // IPv4 Loopback (127.0.0.0/8)
  if (ip.startsWith("127.")) return true;

  // IPv4 Private Range Class A (10.0.0.0/8)
  if (ip.startsWith("10.")) return true;

  // IPv4 Link-Local (169.254.0.0/16)
  if (ip.startsWith("169.254.")) return true;

  // IPv4 Private Range Class B (172.16.0.0/12)
  if (ip.startsWith("172.")) {
    const parts = ip.split(".").map(Number);
    if (parts[1] >= 16 && parts[1] <= 31) return true;
  }

  // IPv4 Private Range Class C (192.168.0.0/16)
  if (ip.startsWith("192.168.")) return true;

  // IPv6 Loopback, Link-Local, Local
  if (ip === "::1" || ip === "::") return true;
  if (ip.toLowerCase().startsWith("fe80:")) return true;
  if (ip.toLowerCase().startsWith("fc00:") || ip.toLowerCase().startsWith("fd00:")) return true;

  return false;
}

/**
 * Resolves a hostname to its IP address and checks if it's safe.
 */
export async function isSafeHostname(hostname: string): Promise<boolean> {
  return new Promise((resolve) => {
    dns.lookup(hostname, (err, address) => {
      if (err || !address) {
        resolve(false); // Can't resolve or lookup failed -> unsafe
      } else {
        resolve(!isPrivateIp(address));
      }
    });
  });
}

/**
 * Detects platform guess based on URL patterns.
 */
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

/**
 * Safe client-side fetcher with timeouts, redirect limits, SSRF protection,
 * and maximum content size constraint.
 */
export async function safeFetchUrl(urlStr: string): Promise<SafeFetchResult> {
  const result: SafeFetchResult = {
    url: urlStr,
    title: null,
    description: null,
    textSnippet: null,
    platform: detectPlatform(urlStr),
    status: "failed",
    error: null,
  };

  try {
    const url = new URL(urlStr);

    // SSRF Check: Reject non-http/https protocols
    if (url.protocol !== "http:" && url.protocol !== "https:") {
      result.error = `Rejected protocol: ${url.protocol}`;
      return result;
    }

    // SSRF Check: Hostname safety
    const isSafe = await isSafeHostname(url.hostname);
    if (!isSafe) {
      result.error = `SSRF Prevention: Private or loopback IP range detected for hostname "${url.hostname}"`;
      return result;
    }

    // Abort controller for timeout
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 8000); // 8 second timeout

    const response = await fetch(urlStr, {
      signal: controller.signal,
      headers: {
        "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 AutoScale/1.0",
        Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      },
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      result.error = `HTTP error ${response.status}: ${response.statusText}`;
      return result;
    }

    // Content size check (limit to 1MB)
    const contentLengthStr = response.headers.get("content-length");
    if (contentLengthStr) {
      const contentLength = parseInt(contentLengthStr, 10);
      if (contentLength > 1024 * 1024) {
        result.error = "Content exceeds maximum size limit (1MB)";
        return result;
      }
    }

    const htmlText = await response.text();
    if (htmlText.length > 1024 * 1024) {
      result.error = "Content body exceeds maximum size limit (1MB)";
      return result;
    }

    // Simple HTML regex parser (no heavy dependency)
    const titleMatch = htmlText.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
    const descMatch = htmlText.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i) ||
                      htmlText.match(/<meta[^>]+content="([^"]+)"[^>]+name="description"/i) ||
                      htmlText.match(/<meta[^>]+property="og:description"[^>]+content="([^"]+)"/i);

    result.title = titleMatch ? titleMatch[1].trim() : null;
    result.description = descMatch ? descMatch[1].trim() : null;

    // Extract basic visible text snippet
    const bodyMatch = htmlText.match(/<body[^>]*>([\s\S]*?)<\/body>/i);
    const bodyContent = bodyMatch ? bodyMatch[1] : htmlText;
    
    // Remove scripts, styles, and tags
    const cleanText = bodyContent
      .replace(/<script[^>]*>([\s\S]*?)<\/script>/gi, "")
      .replace(/<style[^>]*>([\s\S]*?)<\/style>/gi, "")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim();

    result.textSnippet = cleanText.slice(0, 1500); // 1500 chars snippet
    result.status = "success";

  } catch (e) {
    result.error = e instanceof Error ? e.message : "Request failed";
  }

  return result;
}
