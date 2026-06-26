import "server-only";

import {
  fetchPostizIntegrations,
  sendToPostiz,
  testPostizConnection,
  type PostizCredentials,
} from "@/services/postiz/client";
import type {
  PublishingAccount,
  PublishingCredentials,
  PublishingProvider,
  PublishingScheduleInput,
  PublishingScheduleResult,
} from "./provider";
import { isGrowthPublishingPlatform, isPostizCredentials } from "./provider";

function toPostizCredentials(credentials: PublishingCredentials): PostizCredentials {
  return {
    apiUrl: credentials.apiUrl ?? undefined,
    apiKey: credentials.apiKey ?? undefined,
  };
}

function assertPostizCredentials(
  credentials: PublishingCredentials
): PublishingCredentials & { provider: "postiz"; apiUrl: string; apiKey: string } {
  if (!isPostizCredentials(credentials) || !credentials.apiUrl?.trim() || !credentials.apiKey?.trim()) {
    throw new Error("Postiz provider requires Postiz credentials.");
  }
  return credentials;
}

function mapSchedulePayload(input: PublishingScheduleInput) {
  return {
    channel: input.accountId,
    scheduledFor: input.scheduledFor,
    caption: input.caption,
    slides: input.slides,
    imageUrls: input.imageUrls,
    mediaUrls: input.mediaUrls,
    cta: input.cta,
    externalRef: input.externalRef,
    platform: input.platform,
  };
}

export const postizPublishingProvider: PublishingProvider = {
  name: "postiz",

  async validateCredentials({ credentials }) {
    const postiz = assertPostizCredentials(credentials);
    const result = await testPostizConnection(toPostizCredentials(postiz));
    return result.ok ? { ok: true } : { ok: false, reason: result.error };
  },

  async listAccounts({ credentials }) {
    const postiz = assertPostizCredentials(credentials);
    const integrations = await fetchPostizIntegrations(toPostizCredentials(postiz));
    return integrations.map(
      (integration): PublishingAccount => ({
        id: integration.id,
        name: integration.name,
        platform: integration.identifier,
        disabled: integration.disabled,
        profile: integration.profile,
        raw: integration.raw,
      })
    );
  },

  async schedulePost(input): Promise<PublishingScheduleResult> {
    const postiz = assertPostizCredentials(input.credentials);
    return sendToPostiz(toPostizCredentials(postiz), mapSchedulePayload(input));
  },

  async getPostStatus({ credentials, remoteId }) {
    const postiz = assertPostizCredentials(credentials);
    const base = (postiz.apiUrl ?? "https://api.postiz.com").replace(/\/$/, "");
    const url = `${base}/public/v1/posts/${remoteId}`;
    const res = await fetch(url, {
      headers: { Authorization: postiz.apiKey },
      signal: AbortSignal.timeout(15_000),
    });
    if (!res.ok) return null;

    const body = (await res.json()) as {
      status?: string;
      state?: string;
      publishedUrl?: string;
    };
    return {
      status: (body.status ?? body.state ?? "").toLowerCase(),
      postedUrl: body.publishedUrl ?? null,
      raw: body,
    };
  },

  supportsPlatform(platform: string) {
    return isGrowthPublishingPlatform(platform);
  },
};
