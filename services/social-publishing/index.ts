import "server-only";

import {
  getManagedPostBridgeCredentials,
  getManagedPostizCredentials,
} from "@/services/providers/config";
import type { PublishingCredentials, SchedulePostPayload, SchedulePostResult } from "./provider";
import {
  getPublishingProvider,
  getPublishingProviderId,
} from "./resolver";

export type {
  ConnectedPublishingAccount,
  PostBridgePublishingCredentials,
  PostizPublishingCredentials,
  PostStatusResult,
  PublishingCredentialSource,
  PublishingCredentials,
  PublishingProviderId,
  SchedulePostPayload,
  SchedulePostResult,
  SchedulePostStatus,
  SocialPublishingProvider,
} from "./provider";

export {
  isPostBridgeCredentials,
  isPostizCredentials,
} from "./provider";

export {
  getPublishingProvider,
  getPublishingProviderId,
  isPublishingConfigured,
  resolvePublishingCredentials,
} from "./resolver";

export async function testPublishingConnection(
  credentials: PublishingCredentials
): Promise<{ ok: boolean; error?: string }> {
  const provider = getPublishingProvider(credentials.provider);
  return provider.testConnection(credentials);
}

export async function schedulePostViaProvider(
  credentials: PublishingCredentials,
  payload: SchedulePostPayload
): Promise<SchedulePostResult> {
  const provider = getPublishingProvider(credentials.provider);
  return provider.schedulePost(credentials, payload);
}

/** Managed-mode credential probe for the active publishing provider. */
export function getActiveManagedPublishingConfigured(): boolean {
  const providerId = getPublishingProviderId();
  if (providerId === "postbridge") {
    return Boolean(getManagedPostBridgeCredentials());
  }
  return Boolean(getManagedPostizCredentials());
}

export {
  fetchPublishingAccounts,
  getPublishingNotConfiguredMessage,
  getPublishingProviderLabel,
  GROWTH_SYNC_PLATFORMS,
  isGrowthSyncPlatform,
  mapAccountToConnectedAccountRow,
  mapAccountToChannelRow,
  normalizePublishingPlatform,
  syncOwnerPublishingChannels,
  syncProjectConnectedAccounts,
} from "./sync-accounts";
export type { GrowthSyncPlatform } from "./sync-accounts";
