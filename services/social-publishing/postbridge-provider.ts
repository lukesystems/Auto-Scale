import "server-only";

import {
  fetchPostBridgeAccounts,
  getPostBridgePostStatus,
  sendToPostBridge,
  testPostBridgeConnection,
  type PostBridgeCredentials,
} from "@/services/postbridge/client";
import type {
  PublishingAccount,
  PublishingCredentials,
  PublishingProvider,
  PublishingScheduleInput,
  PublishingScheduleResult,
} from "./provider";
import { isGrowthPublishingPlatform, isPostBridgeCredentials } from "./provider";

function toPostBridgeCredentials(credentials: PublishingCredentials): PostBridgeCredentials {
  return {
    apiKey: credentials.apiKey ?? "",
    apiUrl: credentials.apiUrl ?? undefined,
  };
}

function assertPostBridgeCredentials(
  credentials: PublishingCredentials
): PublishingCredentials & { provider: "postbridge"; apiKey: string } {
  if (!isPostBridgeCredentials(credentials) || !credentials.apiKey?.trim()) {
    throw new Error("Post Bridge provider requires Post Bridge credentials.");
  }
  return credentials;
}

function mapSchedulePayload(input: PublishingScheduleInput) {
  return {
    accountId: input.accountId,
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

export const postBridgePublishingProvider: PublishingProvider = {
  name: "postbridge",

  async validateCredentials({ credentials }) {
    const postBridge = assertPostBridgeCredentials(credentials);
    const result = await testPostBridgeConnection(toPostBridgeCredentials(postBridge));
    return result.ok ? { ok: true } : { ok: false, reason: result.error };
  },

  async listAccounts({ credentials }) {
    const postBridge = assertPostBridgeCredentials(credentials);
    const accounts = await fetchPostBridgeAccounts(toPostBridgeCredentials(postBridge));
    return accounts.map(
      (account): PublishingAccount => ({
        id: account.id,
        name: account.name,
        platform: account.platform,
        disabled: account.disabled,
        profile: account.profile,
        raw: account.raw,
      })
    );
  },

  async schedulePost(input): Promise<PublishingScheduleResult> {
    const postBridge = assertPostBridgeCredentials(input.credentials);
    return sendToPostBridge(toPostBridgeCredentials(postBridge), mapSchedulePayload(input));
  },

  async getPostStatus({ credentials, remoteId }) {
    const postBridge = assertPostBridgeCredentials(credentials);
    const statusResult = await getPostBridgePostStatus(
      toPostBridgeCredentials(postBridge),
      remoteId
    );
    if (!statusResult) return null;
    return {
      status: statusResult.status,
      postedUrl: statusResult.postedUrl ?? null,
      raw: statusResult.raw,
    };
  },

  supportsPlatform(platform: string) {
    return isGrowthPublishingPlatform(platform);
  },
};
