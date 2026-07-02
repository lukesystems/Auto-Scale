/**
 * Post Bridge API client (v1).
 *
 * Docs: https://api.post-bridge.com/reference
 * - Base: https://api.post-bridge.com/v1 (override via POST_BRIDGE_API_URL)
 * - Auth: Bearer token in Authorization header
 */

export interface PostBridgeCredentials {
  apiKey: string;
  apiUrl?: string | null;
}

export interface PostBridgeAccount {
  id: string;
  name: string;
  platform: string;
  disabled: boolean;
  profile: string | null;
  raw: unknown;
}

export interface PostBridgeSchedulePayload {
  /** Post Bridge social account ID */
  accountId: string;
  scheduledFor: string;
  caption: string;
  slides?: Array<{ headline: string; body: string }>;
  imageUrls?: string[];
  mediaUrls?: string[];
  /** Pre-uploaded Post Bridge media IDs */
  mediaIds?: string[];
  cta?: string;
  externalRef?: string;
  platform?: string | null;
}

export interface PostBridgeCreatePostBody {
  caption: string;
  scheduled_at: string;
  social_accounts: string[];
  media?: string[];
  media_urls?: string[];
}

export interface PostBridgeScheduleResult {
  ok: boolean;
  status: "scheduled" | "failed" | "pending";
  remoteId?: string;
  error?: string;
  raw?: unknown;
  requestUrl?: string;
}

export interface PostBridgePostStatus {
  status: "posted" | "failed" | "scheduled" | "unknown";
  postedUrl?: string | null;
  raw?: unknown;
}

const DEFAULT_API_BASE = "https://api.post-bridge.com/v1";

export function resolvePostBridgeApiBase(apiUrl?: string | null): string {
  const trimmed = (apiUrl?.trim() || DEFAULT_API_BASE).replace(/\/$/, "");
  if (trimmed.endsWith("/v1")) return trimmed;
  return `${trimmed}/v1`;
}

export function validatePostBridgeConfig(
  creds: PostBridgeCredentials
): { ok: true; apiBase: string } | { ok: false; error: string } {
  if (!creds.apiKey?.trim()) {
    return { ok: false, error: "Post Bridge API key is not configured." };
  }
  const apiBase = resolvePostBridgeApiBase(creds.apiUrl);
  try {
    new URL(apiBase);
  } catch {
    return { ok: false, error: "Post Bridge API URL is not a valid URL." };
  }
  return { ok: true, apiBase };
}

/** Collect unique media URLs from a schedule payload. */
export function collectPostBridgeMediaUrls(payload: PostBridgeSchedulePayload): string[] {
  const urls = [...(payload.mediaUrls ?? []), ...(payload.imageUrls ?? [])];
  return [...new Set(urls.filter(Boolean))];
}

export function buildPostBridgePayload(
  payload: PostBridgeSchedulePayload,
  mediaIds: string[]
): PostBridgeCreatePostBody {
  let caption = payload.caption.trim();
  if (payload.cta?.trim()) {
    caption = `${caption}\n\n${payload.cta.trim()}`;
  }
  if (payload.slides?.length) {
    const slideText = payload.slides
      .map((s, i) => `Slide ${i + 1}: ${s.headline}${s.body ? ` — ${s.body}` : ""}`)
      .join("\n");
    caption = `${caption}\n\n${slideText}`;
  }
  if (payload.externalRef) {
    caption = `${caption}\n\n[ref:${payload.externalRef}]`;
  }

  const body: PostBridgeCreatePostBody = {
    caption,
    scheduled_at: payload.scheduledFor,
    social_accounts: [payload.accountId],
  };

  if (mediaIds.length) {
    body.media = mediaIds;
  }

  return body;
}

function inferFilenameFromUrl(url: string): string {
  try {
    const pathname = new URL(url).pathname;
    const base = pathname.split("/").pop();
    if (base && base.includes(".")) return base;
  } catch {
    // ignore
  }
  return "media.bin";
}

function inferMimeType(url: string, contentType: string | null): string {
  if (contentType && !contentType.includes("application/octet-stream")) {
    return contentType.split(";")[0]!.trim();
  }
  const lower = url.toLowerCase();
  if (lower.endsWith(".mp4")) return "video/mp4";
  if (lower.endsWith(".mov")) return "video/quicktime";
  if (lower.endsWith(".webm")) return "video/webm";
  if (lower.endsWith(".png")) return "image/png";
  if (lower.endsWith(".jpg") || lower.endsWith(".jpeg")) return "image/jpeg";
  if (lower.endsWith(".gif")) return "image/gif";
  return "application/octet-stream";
}

async function postBridgeRequest(
  creds: PostBridgeCredentials,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown; requestUrl: string }> {
  const validated = validatePostBridgeConfig(creds);
  if (!validated.ok) throw new Error(validated.error);
  const requestUrl = `${validated.apiBase}${path.startsWith("/") ? path : `/${path}`}`;
  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      Authorization: `Bearer ${creds.apiKey!.trim()}`,
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(30_000),
  });
  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // preserve non-JSON errors
  }
  return { ok: response.ok, status: response.status, data, requestUrl };
}

export function normalizePostBridgeError(status: number, body: unknown): string {
  const text =
    typeof body === "string"
      ? body
      : body && typeof body === "object" && "message" in body
        ? String((body as { message: unknown }).message)
        : body && typeof body === "object" && "error" in body
          ? String((body as { error: unknown }).error)
          : JSON.stringify(body);

  if (status === 401) return `Post Bridge authentication failed (401): check your API key. ${text}`;
  if (status === 403) return `Post Bridge forbidden (403): ${text}`;
  if (status === 404) return `Post Bridge endpoint not found (404): verify API base URL. ${text}`;
  if (status === 429) return `Post Bridge rate limit exceeded (429): ${text}`;
  return `Post Bridge responded ${status}: ${text}`;
}

export async function testPostBridgeConnection(
  creds: PostBridgeCredentials
): Promise<{ ok: boolean; error?: string }> {
  try {
    const response = await postBridgeRequest(creds, "/social-accounts", {
      method: "GET",
      headers: { "Content-Type": "application/json" },
    });
    return response.ok
      ? { ok: true }
      : { ok: false, error: normalizePostBridgeError(response.status, response.data) };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Post Bridge connection test failed.",
    };
  }
}

function mapSocialAccountRow(item: Record<string, unknown>): PostBridgeAccount | null {
  if (!item.id) return null;
  const platform = String(item.platform ?? item.type ?? item.provider ?? "other");
  const profile =
    (item.username ? String(item.username) : null) ??
    (item.handle ? String(item.handle) : null) ??
    (item.profile ? String(item.profile) : null);
  const name = String(
    item.display_name ?? item.name ?? item.username ?? item.handle ?? platform
  );
  const disabled =
    Boolean(item.disabled) ||
    Boolean(item.is_disabled) ||
    String(item.status ?? "").toLowerCase() === "disabled";

  return {
    id: String(item.id),
    name,
    platform,
    disabled,
    profile,
    raw: item,
  };
}

export async function fetchPostBridgeAccounts(
  creds: PostBridgeCredentials
): Promise<PostBridgeAccount[]> {
  const response = await postBridgeRequest(creds, "/social-accounts", {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) throw new Error(normalizePostBridgeError(response.status, response.data));

  const payload = response.data as { data?: unknown[] } | unknown[];
  const rows = Array.isArray(payload) ? payload : Array.isArray(payload?.data) ? payload.data : [];

  return rows.flatMap((item) => {
    if (!item || typeof item !== "object") return [];
    const mapped = mapSocialAccountRow(item as Record<string, unknown>);
    return mapped ? [mapped] : [];
  });
}

export async function uploadMediaFromUrl(
  creds: PostBridgeCredentials,
  url: string
): Promise<{ id: string }> {
  const validated = validatePostBridgeConfig(creds);
  if (!validated.ok) throw new Error(validated.error);

  const mediaResponse = await fetch(url, { signal: AbortSignal.timeout(120_000) });
  if (!mediaResponse.ok) {
    throw new Error(`Failed to fetch media URL (${mediaResponse.status}): ${url}`);
  }
  const buffer = await mediaResponse.arrayBuffer();
  const mimeType = inferMimeType(url, mediaResponse.headers.get("content-type"));
  const name = inferFilenameFromUrl(url);

  const createResponse = await postBridgeRequest(creds, "/media/create-upload-url", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      name,
      mime_type: mimeType,
      size_bytes: buffer.byteLength,
    }),
    signal: AbortSignal.timeout(60_000),
  });
  if (!createResponse.ok) {
    throw new Error(normalizePostBridgeError(createResponse.status, createResponse.data));
  }

  const createData = createResponse.data as { media_id?: string; upload_url?: string };
  if (!createData?.media_id || !createData?.upload_url) {
    throw new Error("Post Bridge create-upload-url returned no media_id/upload_url");
  }

  const uploadResponse = await fetch(createData.upload_url, {
    method: "PUT",
    headers: { "Content-Type": mimeType },
    body: buffer,
    signal: AbortSignal.timeout(120_000),
  });
  if (!uploadResponse.ok) {
    throw new Error(`Post Bridge media upload failed (${uploadResponse.status})`);
  }

  return { id: String(createData.media_id) };
}

export async function resolvePostBridgeMedia(
  creds: PostBridgeCredentials,
  payload: PostBridgeSchedulePayload
): Promise<string[]> {
  if (payload.mediaIds?.length) return payload.mediaIds;
  const urls = collectPostBridgeMediaUrls(payload);
  const ids: string[] = [];
  for (const mediaUrl of urls) {
    const uploaded = await uploadMediaFromUrl(creds, mediaUrl);
    ids.push(uploaded.id);
  }
  return ids;
}

export function mapPostBridgeRemoteStatus(
  rawStatus: string | null | undefined
): PostBridgePostStatus["status"] {
  const status = (rawStatus ?? "").toLowerCase();
  if (!status) return "unknown";
  if (
    status.includes("publish") ||
    status.includes("posted") ||
    status === "success" ||
    status === "live"
  ) {
    return "posted";
  }
  if (status.includes("fail") || status.includes("error")) return "failed";
  if (status.includes("schedul") || status === "pending" || status === "queued") {
    return "scheduled";
  }
  return "unknown";
}

export async function sendToPostBridge(
  creds: PostBridgeCredentials,
  payload: PostBridgeSchedulePayload
): Promise<PostBridgeScheduleResult> {
  const validated = validatePostBridgeConfig(creds);
  if (!validated.ok) {
    return { ok: false, status: "failed", error: validated.error };
  }

  const requestUrl = `${validated.apiBase}/posts`;
  let body: PostBridgeCreatePostBody;
  try {
    const mediaIds = await resolvePostBridgeMedia(creds, payload);
    body = buildPostBridgePayload(payload, mediaIds);
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      error: e instanceof Error ? e.message : "Post Bridge media upload failed",
      requestUrl,
    };
  }

  try {
    const response = await fetch(requestUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${creds.apiKey!.trim()}`,
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(60_000),
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
        error: normalizePostBridgeError(response.status, parsed),
        raw: parsed,
        requestUrl,
      };
    }

    const record =
      parsed && typeof parsed === "object" && "data" in parsed
        ? (parsed as { data: unknown }).data
        : parsed;
    const remoteId =
      record && typeof record === "object" && record !== null && "id" in record
        ? String((record as { id: unknown }).id)
        : record && typeof record === "object" && record !== null && "post_id" in record
          ? String((record as { post_id: unknown }).post_id)
          : undefined;

    return { ok: true, status: "scheduled", remoteId, raw: parsed, requestUrl };
  } catch (e) {
    return {
      ok: false,
      status: "failed",
      error: e instanceof Error ? e.message : "Post Bridge request threw an unknown error",
      requestUrl,
    };
  }
}

export async function getPostBridgePost(
  creds: PostBridgeCredentials,
  remoteId: string
): Promise<Record<string, unknown> | null> {
  const response = await postBridgeRequest(creds, `/posts/${encodeURIComponent(remoteId)}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });
  if (!response.ok) return null;

  const payload = response.data as { data?: Record<string, unknown> } | Record<string, unknown>;
  const body =
    payload && typeof payload === "object" && "data" in payload && payload.data
      ? (payload.data as Record<string, unknown>)
      : (payload as Record<string, unknown>);
  return body && typeof body === "object" ? body : null;
}

export async function getPostBridgePostStatus(
  creds: PostBridgeCredentials,
  remoteId: string
): Promise<PostBridgePostStatus | null> {
  const body = await getPostBridgePost(creds, remoteId);
  if (!body) return null;

  const rawStatus = String(body.status ?? body.state ?? "");
  const postedUrl =
    (body.published_url ? String(body.published_url) : null) ??
    (body.posted_url ? String(body.posted_url) : null) ??
    (body.url ? String(body.url) : null);

  return {
    status: mapPostBridgeRemoteStatus(rawStatus),
    postedUrl,
    raw: body,
  };
}

export interface PostBridgeAnalyticsQuery {
  platform?: string;
  postResultId?: string;
  timeframe?: "7d" | "30d" | "90d" | "all";
  offset?: number;
  limit?: number;
}

export interface PostBridgeAnalyticsFetchResult {
  ok: boolean;
  records: Record<string, unknown>[];
  raw: unknown;
  error?: string;
}

function unwrapPostBridgeListPayload(data: unknown): Record<string, unknown>[] {
  if (Array.isArray(data)) {
    return data.filter((row): row is Record<string, unknown> => Boolean(row) && typeof row === "object");
  }
  if (data && typeof data === "object" && "data" in data && Array.isArray((data as { data: unknown }).data)) {
    return (data as { data: unknown[] }).data.filter(
      (row): row is Record<string, unknown> => Boolean(row) && typeof row === "object"
    );
  }
  return [];
}

/** Trigger a platform analytics sync (rate-limited to once per 5 minutes per Post Bridge docs). */
export async function syncPostBridgeAnalytics(
  creds: PostBridgeCredentials,
  platform?: string
): Promise<{ ok: boolean; error?: string }> {
  const path = platform
    ? `/analytics/sync?platform=${encodeURIComponent(platform)}`
    : "/analytics/sync";
  const response = await postBridgeRequest(creds, path, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
  });
  if (response.ok) return { ok: true };
  return { ok: false, error: normalizePostBridgeError(response.status, response.data) };
}

/**
 * Fetch analytics from GET /v1/analytics.
 * Docs: https://api.post-bridge.com/reference — supports platform, post_result_id[], timeframe.
 */
export async function fetchPostBridgeAnalytics(
  creds: PostBridgeCredentials,
  query: PostBridgeAnalyticsQuery
): Promise<PostBridgeAnalyticsFetchResult> {
  const params = new URLSearchParams();
  if (query.platform) params.set("platform", query.platform);
  if (query.postResultId) params.append("post_result_id[]", query.postResultId);
  if (query.timeframe) params.set("timeframe", query.timeframe);
  params.set("offset", String(query.offset ?? 0));
  params.set("limit", String(query.limit ?? 25));

  const response = await postBridgeRequest(creds, `/analytics?${params.toString()}`, {
    method: "GET",
    headers: { "Content-Type": "application/json" },
  });

  if (!response.ok) {
    return {
      ok: false,
      records: [],
      raw: response.data,
      error: normalizePostBridgeError(response.status, response.data),
    };
  }

  return {
    ok: true,
    records: unwrapPostBridgeListPayload(response.data),
    raw: response.data,
  };
}

/** Extract per-platform post_result id from a Post Bridge post payload. */
export function extractPostBridgePostResultId(
  post: Record<string, unknown>,
  platform: string
): string | null {
  const normalizedPlatform = platform.toLowerCase();
  const candidates = [
    post.post_results,
    post.results,
    post.platform_results,
    post.publish_results,
  ];

  for (const group of candidates) {
    if (!Array.isArray(group)) continue;
    for (const entry of group) {
      if (!entry || typeof entry !== "object") continue;
      const row = entry as Record<string, unknown>;
      const rowPlatform = String(row.platform ?? row.social_platform ?? "").toLowerCase();
      if (rowPlatform && rowPlatform !== normalizedPlatform) continue;
      const id = row.id ?? row.post_result_id ?? row.result_id;
      if (id != null && String(id).trim()) return String(id);
    }
  }

  const direct = post.post_result_id ?? post.result_id;
  return direct != null && String(direct).trim() ? String(direct) : null;
}
