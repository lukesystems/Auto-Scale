import "server-only";

import type {
  ConnectedPublishingAccount,
  PostBridgePublishingCredentials,
  PostStatusResult,
  PublishingCredentials,
  SchedulePostPayload,
  SchedulePostResult,
  SocialPublishingProvider,
} from "./provider";
import { isPostBridgeCredentials } from "./provider";

const DEFAULT_API_BASE = "https://api.post-bridge.com/v1";

function assertPostBridgeCredentials(
  credentials: PublishingCredentials
): PostBridgePublishingCredentials {
  if (!isPostBridgeCredentials(credentials)) {
    throw new Error("Post Bridge provider requires Post Bridge credentials.");
  }
  return credentials;
}

function resolveApiBase(): string {
  const configured = process.env.POST_BRIDGE_API_URL?.trim();
  if (!configured) return DEFAULT_API_BASE;
  return configured.replace(/\/$/, "");
}

function buildCaption(payload: SchedulePostPayload): string {
  let content = payload.caption.trim();
  if (payload.cta?.trim()) {
    content = `${content}\n\n${payload.cta.trim()}`;
  }
  if (payload.slides?.length) {
    const slideText = payload.slides
      .map((slide, index) => {
        const body = slide.body ? ` — ${slide.body}` : "";
        return `Slide ${index + 1}: ${slide.headline}${body}`;
      })
      .join("\n");
    content = `${content}\n\n${slideText}`;
  }
  if (payload.externalRef) {
    content = `${content}\n\n[ref:${payload.externalRef}]`;
  }
  return content;
}

function collectMediaUrls(payload: SchedulePostPayload): string[] {
  const urls = [...(payload.mediaUrls ?? []), ...(payload.imageUrls ?? [])];
  return [...new Set(urls.filter(Boolean))];
}

function normalizePostBridgeError(status: number, body: unknown): string {
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
  if (status === 404) return `Post Bridge endpoint not found (404): ${text}`;
  if (status === 429) return `Post Bridge rate limit exceeded (429): ${text}`;
  return `Post Bridge responded ${status}: ${text}`;
}

async function postBridgeRequest(
  credentials: PostBridgePublishingCredentials,
  path: string,
  init?: RequestInit
): Promise<{ ok: boolean; status: number; data: unknown; requestUrl: string }> {
  const requestUrl = `${resolveApiBase()}${path}`;
  const response = await fetch(requestUrl, {
    ...init,
    headers: {
      Authorization: `Bearer ${credentials.apiKey.trim()}`,
      ...init?.headers,
    },
    signal: init?.signal ?? AbortSignal.timeout(15_000),
  });

  const text = await response.text();
  let data: unknown = text;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    // Keep non-JSON errors for diagnostics.
  }

  return { ok: response.ok, status: response.status, data, requestUrl };
}

function mapSocialAccount(item: Record<string, unknown>): ConnectedPublishingAccount | null {
  const id = item.id ?? item.account_id;
  if (id == null) return null;

  const platform = String(item.platform ?? item.provider ?? item.type ?? "unknown");
  const username = item.username ?? item.handle ?? item.name;
  const disabled = Boolean(item.disabled ?? item.is_disabled ?? false);

  return {
    id: String(id),
    name: String(username ?? `${platform} account`),
    platform,
    disabled,
    profile: username ? String(username) : null,
    raw: item,
  };
}

function extractRemoteId(data: unknown): string | undefined {
  if (!data || typeof data !== "object") return undefined;
  const row = data as Record<string, unknown>;
  const candidate = row.id ?? row.post_id ?? row.postId;
  return candidate != null ? String(candidate) : undefined;
}

export const postBridgePublishingProvider: SocialPublishingProvider = {
  id: "postbridge",

  async testConnection(credentials) {
    const postBridge = assertPostBridgeCredentials(credentials);
    if (!postBridge.apiKey.trim()) {
      return { ok: false, error: "Post Bridge API key is not configured." };
    }

    try {
      const response = await postBridgeRequest(postBridge, "/social-accounts");
      return response.ok
        ? { ok: true }
        : { ok: false, error: normalizePostBridgeError(response.status, response.data) };
    } catch (error) {
      return {
        ok: false,
        error: error instanceof Error ? error.message : "Post Bridge connection test failed.",
      };
    }
  },

  async listConnectedAccounts(credentials) {
    const postBridge = assertPostBridgeCredentials(credentials);
    const response = await postBridgeRequest(postBridge, "/social-accounts");
    if (!response.ok) {
      throw new Error(normalizePostBridgeError(response.status, response.data));
    }

    const payload = response.data;
    const rows = Array.isArray(payload)
      ? payload
      : payload && typeof payload === "object" && Array.isArray((payload as { data?: unknown }).data)
        ? ((payload as { data: unknown[] }).data ?? [])
        : [];

    return rows.flatMap((item) => {
      if (!item || typeof item !== "object") return [];
      const mapped = mapSocialAccount(item as Record<string, unknown>);
      return mapped ? [mapped] : [];
    });
  },

  async schedulePost(credentials, payload): Promise<SchedulePostResult> {
    const postBridge = assertPostBridgeCredentials(credentials);
    if (!postBridge.apiKey.trim()) {
      return { ok: false, status: "failed", error: "Post Bridge API key is not configured." };
    }

    const requestUrl = `${resolveApiBase()}/posts`;
    const mediaUrls = collectMediaUrls(payload);
    const body: Record<string, unknown> = {
      caption: buildCaption(payload),
      scheduled_at: payload.scheduledFor,
      social_accounts: [payload.accountId],
    };
    if (mediaUrls.length) {
      body.media_urls = mediaUrls;
    }

    try {
      const response = await postBridgeRequest(postBridge, "/posts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(120_000),
      });

      if (!response.ok) {
        return {
          ok: false,
          status: "failed",
          error: normalizePostBridgeError(response.status, response.data),
          raw: response.data,
          requestUrl,
        };
      }

      const remoteId = extractRemoteId(response.data);
      return {
        ok: true,
        status: "scheduled",
        remoteId,
        raw: response.data,
        requestUrl,
      };
    } catch (error) {
      return {
        ok: false,
        status: "failed",
        error: error instanceof Error ? error.message : "Post Bridge request threw an unknown error",
        requestUrl,
      };
    }
  },

  async getPostStatus(credentials, remoteId): Promise<PostStatusResult | null> {
    const postBridge = assertPostBridgeCredentials(credentials);
    const response = await postBridgeRequest(postBridge, `/posts/${remoteId}`);
    if (!response.ok) return null;

    const body =
      response.data && typeof response.data === "object"
        ? (response.data as Record<string, unknown>)
        : {};
    const status = String(body.status ?? body.state ?? "").toLowerCase();
    const postedUrl =
      (body.posted_url as string | undefined) ??
      (body.published_url as string | undefined) ??
      (body.url as string | undefined) ??
      null;

    return { status, postedUrl, raw: response.data };
  },
};
