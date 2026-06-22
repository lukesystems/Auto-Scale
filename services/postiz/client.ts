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

export interface PostizMediaAttachment {
  id: string;
  path: string;
  mimeType?: string;
}

export interface PostizSchedulePayload {
  /** Postiz integration ID (UI calls this "channel") */
  channel: string;
  scheduledFor: string;
  caption: string;
  slides?: Array<{ headline: string; body: string }>;
  /** Legacy: external URLs — uploaded to Postiz before posting when possible */
  imageUrls?: string[];
  /** Preferred: MP4/image URLs — uploaded to Postiz before posting */
  mediaUrls?: string[];
  /** Pre-uploaded Postiz media (id + path from /upload or /upload-from-url) */
  media?: PostizMediaAttachment[];
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

export interface PostizIntegration {
  id: string;
  name: string;
  identifier: string;
  disabled: boolean;
  profile: string | null;
  raw: unknown;
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

export function buildPostizPayload(
  payload: PostizSchedulePayload,
  media?: PostizMediaAttachment[]
): PostizCreatePostBody {
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

  const attachments = media ?? payload.media ?? [];
  // Postiz uses the `image` array for both images and videos (id + path required).
  const imageField = attachments.map((m) => ({ id: m.id, path: m.path }));

  return {
    type: "schedule",
    date: payload.scheduledFor,
    shortLink: false,
    tags: [],
    posts: [
      {
        integration: { id: payload.channel },
        value: [{ content, image: imageField }],
        settings: { __type: mapPlatformToPostizType(payload.platform) },
      },
    ],
  };
}

/** Collect unique media URLs from a schedule payload. */
export function collectPostizMediaUrls(payload: PostizSchedulePayload): string[] {
  const urls = [...(payload.mediaUrls ?? []), ...(payload.imageUrls ?? [])];
  return [...new Set(urls.filter(Boolean))];
}

export async function uploadMediaFromUrl(
  creds: PostizCredentials,
  url: string
): Promise<PostizMediaAttachment> {
  const validated = validatePostizConfig(creds);
  if (!validated.ok) throw new Error(validated.error);

  const response = await postizRequest(creds, "/upload-from-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ url }),
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    throw new Error(normalizePostizError(response.status, response.data));
  }
  const data = response.data as { id?: string; path?: string };
  if (!data?.id || !data?.path) {
    throw new Error("Postiz upload-from-url returned no id/path");
  }
  return { id: String(data.id), path: String(data.path) };
}

export async function resolvePostizMedia(
  creds: PostizCredentials,
  payload: PostizSchedulePayload
): Promise<PostizMediaAttachment[]> {
  if (payload.media?.length) return payload.media;
  const urls = collectPostizMediaUrls(payload);
  const uploaded: PostizMediaAttachment[] = [];
  for (const url of urls) {
    uploaded.push(await uploadMediaFromUrl(creds, url));
  }
  return uploaded;
}

async function postizRequest(
  creds: PostizCredentials,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown; requestUrl: string }> {
  const validated = validatePostizConfig(creds);
  if (!validated.ok) throw new Error(validated.error);
  const requestUrl = `${validated.apiBase}${path}`;
  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      Authorization: creds.apiKey!.trim(),
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Preserve non-JSON errors for diagnostics.
  }
  return { ok: response.ok, status: response.status, data, requestUrl };
}

export async function testPostizConnection(creds: PostizCredentials): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await postizRequest(creds, "/is-connected");
    return response.ok
      ? { ok: true }
      : { ok: false, error: normalizePostizError(response.status, response.data) };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Postiz connection test failed." };
  }
}

export async function fetchPostizIntegrations(creds: PostizCredentials): Promise<PostizIntegration[]> {
  const response = await postizRequest(creds, "/integrations");
  if (!response.ok) throw new Error(normalizePostizError(response.status, response.data));
  if (!Array.isArray(response.data)) return [];

  return response.data.flatMap((item) => {
    if (!item || typeof item !== "object" || !("id" in item)) return [];
    const row = item as Record<string, unknown>;
    return [{
      id: String(row.id),
      name: String(row.name ?? row.identifier ?? "Unnamed channel"),
      identifier: String(row.identifier ?? "other"),
      disabled: Boolean(row.disabled),
      profile: row.profile ? String(row.profile) : null,
      raw: item,
    }];
  });
}

export function createPostizClient(creds: PostizCredentials) {
  return {
    testConnection: () => testPostizConnection(creds),
    listIntegrations: () => fetchPostizIntegrations(creds),
    schedulePost: (payload: PostizSchedulePayload) => sendToPostiz(creds, payload),
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
  let body: PostizCreatePostBody;
  try {
    const media = await resolvePostizMedia(creds, payload);
    body = buildPostizPayload(payload, media);
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      error: e instanceof Error ? e.message : "Postiz media upload failed",
      requestUrl,
    };
  }

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

    const first = Array.isArray(parsed) ? parsed[0] : parsed;
    const remoteId =
      typeof first === "object" && first !== null && ("postId" in first || "id" in first)
        ? String("postId" in first ? (first as { postId: unknown }).postId : (first as { id: unknown }).id)
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
