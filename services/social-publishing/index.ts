import "server-only";

import {
  getManagedPostBridgeCredentials,
} from "@/services/providers/config";
import type {
  PublishingCredentials,
  PublishingSchedulePayload,
  PublishingScheduleResult,
} from "./provider";
import {
  getPublishingProvider,
  getPublishingProviderId,
} from "./resolver";

export type {
  ConnectedPublishingAccount,
  PostStatusResult,
  PublishingAccount,
  PublishingCredentialSource,
  PublishingCredentials,
  PublishingCredentialsInput,
  PublishingPlatform,
  PublishingPostStatusInput,
  PublishingPostStatusResult,
  PublishingProvider,
  PublishingProviderId,
  PublishingProviderName,
  PublishingScheduleInput,
  PublishingSchedulePayload,
  PublishingScheduleResult,
  PublishingScheduleStatus,
  SchedulePostPayload,
  SchedulePostResult,
  SchedulePostStatus,
  SocialPublishingProvider,
} from "./provider";

export {
  GROWTH_PUBLISHING_PLATFORMS,
  isGrowthPublishingPlatform,
  isPostBridgeCredentials,
  normalizePublishingPlatform,
} from "./provider";

export {
  getPublishingProvider,
  getPublishingProviderId,
  isPublishingConfigured,
  isRemotePublishingEnabled,
  resolvePublishingCredentials,
} from "./resolver";

export async function validatePublishingCredentials(
  credentials: PublishingCredentials
): Promise<{ ok: boolean; reason?: string; error?: string }> {
  const provider = getPublishingProvider(credentials.provider);
  const result = await provider.validateCredentials({ credentials });
  return result.ok ? { ok: true } : { ok: false, reason: result.reason, error: result.reason };
}

/** @deprecated Use validatePublishingCredentials */
export async function testPublishingConnection(
  credentials: PublishingCredentials
): Promise<{ ok: boolean; error?: string }> {
  const result = await validatePublishingCredentials(credentials);
  return result.ok ? { ok: true } : { ok: false, error: result.error ?? result.reason };
}

export async function schedulePostViaProvider(
  credentials: PublishingCredentials,
  payload: PublishingSchedulePayload
): Promise<PublishingScheduleResult> {
  const provider = getPublishingProvider(credentials.provider);
  return provider.schedulePost({ credentials, ...payload });
}

export async function getPublishingPostStatus(
  credentials: PublishingCredentials,
  remoteId: string
): Promise<import("./provider").PublishingPostStatusResult | null> {
  const provider = getPublishingProvider(credentials.provider);
  return provider.getPostStatus({ credentials, remoteId });
}

/** Managed-mode credential probe for remote publishing (active provider). */
export function getActiveManagedPublishingConfigured(): boolean {
  return Boolean(getManagedPostBridgeCredentials());
}

export {
  fetchPublishingAccounts,
  getPublishingNotConfiguredMessage,
  getPublishingProviderLabel,
  GROWTH_SYNC_PLATFORMS,
  isGrowthSyncPlatform,
  mapAccountToConnectedAccountRow,
  mapAccountToChannelRow,
  syncOwnerPublishingChannels,
  syncProjectConnectedAccounts,
} from "./sync-accounts";
export type { GrowthSyncPlatform } from "./sync-accounts";
