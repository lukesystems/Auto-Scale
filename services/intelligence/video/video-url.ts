import type { VideoPlatform, VideoSourceType } from "./schema";

export interface VideoUrlInfo {
  platform: VideoPlatform;
  sourceType: VideoSourceType;
  canonicalUrl: string;
  accountHandle: string | null;
  accountUrl: string | null;
}

const TRACKING_PARAMS = new Set(["feature", "si", "utm_source", "utm_medium", "utm_campaign", "utm_content", "igsh"]);

export function detectVideoPlatform(value: string): VideoPlatform {
  try {
    const host = new URL(value).hostname.toLowerCase().replace(/^www\./, "");
    if (host === "tiktok.com" || host.endsWith(".tiktok.com")) return "tiktok";
    if (host === "instagram.com" || host.endsWith(".instagram.com")) return "instagram";
    if (host === "youtube.com" || host.endsWith(".youtube.com") || host === "youtu.be") return "youtube";
  } catch {
    // Invalid URLs are classified as other and rejected by callers that require a URL.
  }
  return "other";
}

export function detectVideoSourceType(value: string): VideoSourceType {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const platform = detectVideoPlatform(value);
    if (platform === "tiktok") {
      if (segments[0]?.startsWith("@") && segments[1] === "video" && segments[2]) return "video";
      if (segments[0]?.startsWith("@") && segments.length === 1) return "profile";
    }
    if (platform === "instagram") {
      if (["reel", "reels"].includes(segments[0] ?? "") && segments[1]) return "video";
      if (segments.length === 1 && !["p", "tv", "explore", "accounts"].includes(segments[0] ?? "")) return "profile";
    }
    if (platform === "youtube") {
      if ((segments[0] === "shorts" && segments[1]) || url.hostname === "youtu.be") return "video";
      if (segments[0]?.startsWith("@") || ["channel", "c", "user"].includes(segments[0] ?? "")) return "profile";
    }
  } catch {
    return "unknown";
  }
  return "unknown";
}

export function canonicalizeVideoUrl(value: string): string {
  try {
    const url = new URL(value.trim());
    url.protocol = "https:";
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.hash = "";
    for (const key of [...url.searchParams.keys()]) {
      if (TRACKING_PARAMS.has(key.toLowerCase())) url.searchParams.delete(key);
    }
    if (url.hostname === "m.tiktok.com") url.hostname = "tiktok.com";
    if (url.hostname === "youtu.be") {
      const id = url.pathname.split("/").filter(Boolean)[0];
      if (id) {
        url.hostname = "youtube.com";
        url.pathname = `/shorts/${id}`;
        url.search = "";
      }
    }
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return value.trim();
  }
}

export function extractVideoAccountHandle(value: string): string | null {
  try {
    const url = new URL(value);
    const segments = url.pathname.split("/").filter(Boolean);
    const platform = detectVideoPlatform(value);
    if (platform === "tiktok" && segments[0]?.startsWith("@")) return segments[0].slice(1).toLowerCase();
    if (platform === "instagram" && detectVideoSourceType(value) === "profile") return segments[0]?.toLowerCase() ?? null;
    if (platform === "youtube" && segments[0]?.startsWith("@")) return segments[0].slice(1).toLowerCase();
  } catch {
    return null;
  }
  return null;
}

export function inspectVideoUrl(value: string): VideoUrlInfo {
  const canonicalUrl = canonicalizeVideoUrl(value);
  const platform = detectVideoPlatform(canonicalUrl);
  const sourceType = detectVideoSourceType(canonicalUrl);
  const accountHandle = extractVideoAccountHandle(canonicalUrl);
  const accountUrl = accountHandle
    ? platform === "tiktok"
      ? `https://tiktok.com/@${accountHandle}`
      : platform === "instagram"
        ? `https://instagram.com/${accountHandle}`
        : platform === "youtube"
          ? `https://youtube.com/@${accountHandle}`
          : null
    : null;
  return { platform, sourceType, canonicalUrl, accountHandle, accountUrl };
}

export function isSupportedPublicVideoUrl(value: string): boolean {
  const info = inspectVideoUrl(value);
  return info.platform !== "other" && info.sourceType !== "unknown";
}
