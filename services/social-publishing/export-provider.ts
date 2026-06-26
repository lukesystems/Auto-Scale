import "server-only";

import type { PublishingProvider } from "./provider";
import { isGrowthPublishingPlatform } from "./provider";

export const exportPublishingProvider: PublishingProvider = {
  name: "export_only",

  async validateCredentials() {
    return { ok: true };
  },

  async listAccounts() {
    return [];
  },

  async schedulePost(input) {
    return {
      ok: true,
      status: "queued",
      raw: {
        mode: "export_only",
        accountId: input.accountId,
        scheduledFor: input.scheduledFor,
      },
    };
  },

  async getPostStatus() {
    return null;
  },

  supportsPlatform(platform: string) {
    return isGrowthPublishingPlatform(platform);
  },
};
