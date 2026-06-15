/**
 * Postiz Public API client (v1).
 *
 * Docs: https://docs.postiz.com/public-api/posts/create
 * - Base: {apiUrl}/public/v1  (cloud: https://api.postiz.com/public/v1)
 * - Auth: raw API key in Authorization header (no Bearer prefix)
 * - Create: POST /posts
 */

export interface PostizCredentials {
  apiUrl?: string | null;
  apiKey?: string | null;
}

export interface PostizSchedulePayload {
  /** Postiz integration ID (UI calls this "channel") */
  channel: string;
  scheduledFor: string;
  caption: string;
  slides?: Array<{ headline: string; body: string }>;
  imageUrls?: string[];
  cta?: string;
  externalRef?: string;
  /** Platform hint for settings.__type mapping */
  platform?: string | null;
}

export interface PostizCreatePostBody {
  type: "schedule" | "now" | "draft";
  date: string;
  shortLink: boolean;
  tags: string[];
  posts: Array<{
    integration: { id: string };
    value: Array<{ content: string; image: unknown[] }>;
    settings: { __type: string };
  }>;
}

export interface PostizSchedulePostResponse {
  ok: boolean;
  status: "scheduled" | "failed" | "pending";
  remoteId?: string;
  error?: string;
  raw?: unknown;
  requestUrl?: string;
}

const PLATFORM_TYPE_MAP: Record<string, string> = {
  tiktok: "tiktok",
  instagram: "instagram",
  x: "x",
  twitter: "x",
  linkedin: "linkedin",
  youtube: "youtube",
  threads: "threads",
  pinterest: "pinterest",
  facebook: "facebook",
  reddit: "reddit",
  bluesky: "bluesky",
  mastodon: "mastodon",
  telegram: "telegram",
};

export function resolvePostizApiBase(apiUrl: string): string {
  const trimmed = apiUrl.replace(/\/$/, "");
  if (trimmed.endsWith("/public/v1")) return trimmed;
  if (trimmed.endsWith("/api/public/v1")) return trimmed;
  return `${trimmed}/public/v1`;
}

export function validatePostizConfig(
  creds: PostizCredentials
): { ok: true; apiBase: string } | { ok: false; error: string } {
  if (!creds.apiUrl?.trim()) {
    return { ok: false, error: "Postiz API URL is not configured." };
  }
  if (!creds.apiKey?.trim()) {
    return { ok: false, error: "Postiz API key is not configured." };
  }
  try {
    new URL(creds.apiUrl);
  } catch {
    return { ok: false, error: "Postiz API URL is not a valid URL." };
  }
  return { ok: true, apiBase: resolvePostizApiBase(creds.apiUrl) };
}

export function mapPlatformToPostizType(platform?: string | null): string {
  if (!platform) return "threads";
  const key = platform.toLowerCase().replace(/[^a-z0-9-]/g, "");
  return PLATFORM_TYPE_MAP[key] ?? "threads";
}

export function buildPostizPayload(payload: PostizSchedulePayload): PostizCreatePostBody {
  let content = payload.caption.trim();
  if (payload.cta?.trim()) {
    content = `${content}\n\n${payload.cta.trim()}`;
  }
  if (payload.slides?.length) {
    const slideText = payload.slides
      .map((s, i) => `Slide ${i + 1}: ${s.headline}${s.body ? ` — ${s.body}` : ""}`)
      .join("\n");
    content = `${content}\n\n${slideText}`;
  }
  if (payload.externalRef) {
    content = `${content}\n\n[ref:${payload.externalRef}]`;
  }

  return {
    type: "schedule",
    date: payload.scheduledFor,
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: payload.channel },
        value: [{ content, image: payload.imageUrls?.map((url) => ({ path: url })) ?? [] }],
        settings: { __type: mapPlatformToPostizType(payload.platform) },
      },
    ],
  };
}

export function normalizePostizError(status: number, body: unknown): string {
  const text =
    typeof body === "string"
      ? body
      : body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : JSON.stringify(body);

  if (status === 401) return `Postiz authentication failed (401): check your API key. ${text}`;
  if (status === 403) return `Postiz forbidden (403): ${text}`;
  if (status === 404) return `Postiz endpoint not found (404): verify API URL includes /public/v1. ${text}`;
  if (status === 429) return `Postiz rate limit exceeded (429): ${text}`;
  return `Postiz responded ${status}: ${text}`;
}

export async function sendToPostiz(
  creds: PostizCredentials,
  payload: PostizSchedulePayload
): Promise<PostizSchedulePostResponse> {
  const validated = validatePostizConfig(creds);
  if (!validated.ok) {
    return { ok: false, status: "failed", error: validated.error };
  }

  const requestUrl = `${validated.apiBase}/posts`;
  const body = buildPostizPayload(payload);

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: creds.apiKey!.trim(),
      },
      body: JSON.stringify(body),
    });

    const rawText = await response.text();
    let parsed: unknown = rawText;
    try {
      parsed = JSON.parse(rawText);
    } catch {
      // keep text
    }

    if (!response.ok) {
      return {
        ok: false,
        status: "failed",
        error: normalizePostizError(response.status, parsed),
        raw: parsed,
        requestUrl,
      };
    }

    const remoteId =
      typeof parsed === "object" && parsed !== null && "id" in parsed
        ? String((parsed as { id: unknown }).id)
        : undefined;

    return { ok: true, status: "scheduled", remoteId, raw: parsed, requestUrl };
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      error: e instanceof Error ? e.message : "Postiz request threw an unknown error",
      requestUrl,
    };
  }
}
