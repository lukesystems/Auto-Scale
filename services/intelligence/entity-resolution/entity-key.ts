/**
 * Stable identity keys that let us recognize the same competitor across
 * multiple discovered sources (homepage + pricing + X account + Reddit
 * thread). Keys are deterministic strings so the same input always yields
 * the same key — they are stored alongside competitors and source candidates
 * for fast matching without name-similarity guesswork.
 *
 * Keys come in three shapes:
 *   - domain:<eTLD+1>          e.g. domain:roui.dev
 *   - handle:<platform>:<id>   e.g. handle:x:roui
 *   - name:<slug>              e.g. name:rouidesignsystem
 *
 * Domain keys are strongest and preferred whenever available.
 */

const KNOWN_PUBLIC_SUFFIXES = new Set([
  "co.uk",
  "co.jp",
  "co.kr",
  "co.in",
  "co.nz",
  "com.au",
  "com.br",
  "com.mx",
  "com.sg",
  "com.cn",
]);

/**
 * Strip "www." and platform-specific noise to get the eTLD+1 host. Falls back
 * to the whole hostname if URL parsing fails.
 */
export function extractRegistrableDomain(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const hostname = parsed.hostname.toLowerCase().replace(/^www\./, "");
    if (!hostname) return null;

    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;

    const lastTwo = parts.slice(-2).join(".");
    const lastThree = parts.slice(-3).join(".");

    if (KNOWN_PUBLIC_SUFFIXES.has(lastTwo)) return lastThree;
    return lastTwo;
  } catch {
    return null;
  }
}

/**
 * Hostnames that don't identify a competitor — they identify the platform a
 * competitor is *on* (e.g. youtube.com hosts every creator). Keys derived from
 * these are skipped so we never collapse multiple competitors into one.
 */
const PLATFORM_HOSTS = new Set([
  "x.com",
  "twitter.com",
  "youtube.com",
  "youtu.be",
  "linkedin.com",
  "tiktok.com",
  "instagram.com",
  "reddit.com",
  "facebook.com",
  "threads.net",
  "pinterest.com",
  "medium.com",
  "substack.com",
  "github.com",
  "devforum.roblox.com",
]);

export function isPlatformHost(host: string | null): boolean {
  if (!host) return false;
  return PLATFORM_HOSTS.has(host.replace(/^www\./, "").toLowerCase());
}

export function domainEntityKey(url: string): string | null {
  const domain = extractRegistrableDomain(url);
  if (!domain) return null;
  if (isPlatformHost(domain)) return null;
  return `domain:${domain}`;
}

const HANDLE_NOISE = new Set([
  "status",
  "statuses",
  "p",
  "post",
  "posts",
  "video",
  "videos",
  "reel",
  "reels",
  "shorts",
  "watch",
  "channel",
  "c",
  "user",
  "share",
  "r",
  "comments",
]);

/**
 * Pull a creator/company handle out of a known platform URL. Returns null when
 * the URL points at an article/post/comment thread instead of a profile.
 */
export function handleEntityKey(url: string): string | null {
  try {
    const parsed = new URL(url.trim());
    const host = parsed.hostname.toLowerCase().replace(/^www\./, "");
    const segments = parsed.pathname.split("/").filter(Boolean);
    if (!segments.length) return null;

    const platform = platformFromHost(host);
    if (!platform) return null;

    let handle: string | null = null;

    if (platform === "x") {
      const first = segments[0]?.replace(/^@/, "");
      if (first && !HANDLE_NOISE.has(first)) handle = first;
    } else if (platform === "youtube") {
      if (segments[0]?.startsWith("@")) handle = segments[0].slice(1);
      else if (segments[0] === "channel" || segments[0] === "c" || segments[0] === "user") {
        handle = segments[1] ?? null;
      }
    } else if (platform === "linkedin") {
      if ((segments[0] === "company" || segments[0] === "school" || segments[0] === "in") && segments[1]) {
        handle = segments[1];
      }
    } else if (platform === "tiktok" || platform === "instagram" || platform === "threads") {
      const first = segments[0]?.replace(/^@/, "");
      if (first && !HANDLE_NOISE.has(first)) handle = first;
    } else if (platform === "reddit") {
      if (segments[0] === "r" && segments[1]) handle = `r/${segments[1]}`;
      else if (segments[0] === "user" && segments[1]) handle = `u/${segments[1]}`;
    } else if (platform === "github") {
      if (segments[0] && !HANDLE_NOISE.has(segments[0])) handle = segments[0];
    }

    if (!handle) return null;
    return `handle:${platform}:${handle.toLowerCase()}`;
  } catch {
    return null;
  }
}

function platformFromHost(host: string): string | null {
  if (host === "x.com" || host === "twitter.com") return "x";
  if (host === "youtube.com" || host === "youtu.be") return "youtube";
  if (host === "linkedin.com") return "linkedin";
  if (host === "tiktok.com") return "tiktok";
  if (host === "instagram.com") return "instagram";
  if (host === "threads.net") return "threads";
  if (host === "reddit.com") return "reddit";
  if (host === "github.com") return "github";
  return null;
}

/** Slugify a brand name into a stable name key. Rejects 1–2 char garbage. */
export function nameEntityKey(name: string | null | undefined): string | null {
  if (!name) return null;
  const slug = name
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "")
    .trim();
  if (slug.length < 3) return null;
  return `name:${slug}`;
}

export interface EntityKeyCandidate {
  url?: string | null;
  name?: string | null;
}

/**
 * All possible identity keys for a candidate, in priority order
 * (strongest first). Used to match new evidence to existing competitors.
 */
export function entityKeysFor(input: EntityKeyCandidate): string[] {
  const keys: string[] = [];
  const seen = new Set<string>();
  const push = (k: string | null) => {
    if (!k || seen.has(k)) return;
    seen.add(k);
    keys.push(k);
  };

  if (input.url) {
    push(domainEntityKey(input.url));
    push(handleEntityKey(input.url));
  }
  push(nameEntityKey(input.name));
  return keys;
}

/**
 * The canonical key to persist on a competitor row. Domain wins, then handle,
 * then name. Returns null only when the input has no usable identity at all.
 */
export function primaryEntityKey(input: {
  urls?: Array<string | null | undefined>;
  name?: string | null;
}): string | null {
  for (const url of input.urls ?? []) {
    if (!url) continue;
    const key = domainEntityKey(url);
    if (key) return key;
  }
  for (const url of input.urls ?? []) {
    if (!url) continue;
    const key = handleEntityKey(url);
    if (key) return key;
  }
  return nameEntityKey(input.name);
}
