import "server-only";

import type { PublishingProvider } from "./provider";
import { isGrowthPublishingPlatform, POSTBRIDGE_PROVIDER_STUB_REASON } from "./provider";

/**
 * Post Bridge adapter stub.
 *
 * Do not call Post Bridge APIs until docs, auth, upload, scheduling,
 * status, limits, and pricing are confirmed.
 */
export const postBridgePublishingProvider: PublishingProvider = {
  name: "postbridge",

  async validateCredentials() {
    return { ok: false, reason: POSTBRIDGE_PROVIDER_STUB_REASON };
  },

  async listAccounts() {
    throw new Error(POSTBRIDGE_PROVIDER_STUB_REASON);
  },

  async schedulePost() {
    return {
      ok: false,
      status: "failed",
      error: POSTBRIDGE_PROVIDER_STUB_REASON,
    };
  },

  async getPostStatus() {
    return null;
  },

  supportsPlatform(platform: string) {
    return isGrowthPublishingPlatform(platform);
  },
};
