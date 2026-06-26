import "server-only";

import {
  fetchPostizIntegrations,
  sendToPostiz,
  testPostizConnection,
  type PostizCredentials,
} from "@/services/postiz/client";
import type {
  ConnectedPublishingAccount,
  PostizPublishingCredentials,
  PublishingCredentials,
  SchedulePostPayload,
  SchedulePostResult,
  SocialPublishingProvider,
} from "./provider";
import { isPostizCredentials } from "./provider";

function toPostizCredentials(credentials: PostizPublishingCredentials): PostizCredentials {
  return {
    apiUrl: credentials.apiUrl,
    apiKey: credentials.apiKey,
  };
}

function assertPostizCredentials(
  credentials: PublishingCredentials
): PostizPublishingCredentials {
  if (!isPostizCredentials(credentials)) {
    throw new Error("Postiz provider requires Postiz credentials.");
  }
  return credentials;
}

function mapSchedulePayload(payload: SchedulePostPayload) {
  return {
    channel: payload.accountId,
    scheduledFor: payload.scheduledFor,
    caption: payload.caption,
    slides: payload.slides,
    imageUrls: payload.imageUrls,
    mediaUrls: payload.mediaUrls,
    cta: payload.cta,
    externalRef: payload.externalRef,
    platform: payload.platform,
  };
}

export const postizPublishingProvider: SocialPublishingProvider = {
  id: "postiz",

  async testConnection(credentials) {
    const postiz = assertPostizCredentials(credentials);
    return testPostizConnection(toPostizCredentials(postiz));
  },

  async listConnectedAccounts(credentials) {
    const postiz = assertPostizCredentials(credentials);
    const integrations = await fetchPostizIntegrations(toPostizCredentials(postiz));
    return integrations.map(
      (integration): ConnectedPublishingAccount => ({
        id: integration.id,
        name: integration.name,
        platform: integration.identifier,
        disabled: integration.disabled,
        profile: integration.profile,
        raw: integration.raw,
      })
    );
  },

  async schedulePost(credentials, payload): Promise<SchedulePostResult> {
    const postiz = assertPostizCredentials(credentials);
    return sendToPostiz(toPostizCredentials(postiz), mapSchedulePayload(payload));
  },

  async getPostStatus(credentials, remoteId) {
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
};
