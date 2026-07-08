import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { isManagedMode } from "@/lib/provider-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { PublishingAccount, PublishingCredentials } from "./provider";
import { GROWTH_PUBLISHING_PLATFORMS, isGrowthPublishingPlatform, normalizePublishingPlatform } from "./provider";
import {
  getPublishingProvider,
  getPublishingProviderId,
  isRemotePublishingEnabled,
  resolvePublishingCredentials,
} from "./resolver";

export const GROWTH_SYNC_PLATFORMS = GROWTH_PUBLISHING_PLATFORMS;
export type GrowthSyncPlatform = (typeof GROWTH_SYNC_PLATFORMS)[number];

export function isGrowthSyncPlatform(platform: string): platform is GrowthSyncPlatform {
  return isGrowthPublishingPlatform(platform);
}

export function getPublishingProviderLabel(_providerId = getPublishingProviderId()): "Post Bridge" {
  return "Post Bridge";
}

export function getPublishingNotConfiguredMessage(providerMode: ProviderMode): string {
  return isManagedMode(providerMode)
    ? "Post Bridge is not connected. Add POST_BRIDGE_API_KEY on the server."
    : "Post Bridge is not connected. Connect Post Bridge in Settings.";
}

export async function fetchPublishingAccounts(
  userId: string,
  providerMode: ProviderMode
): Promise<{ credentials: PublishingCredentials; accounts: PublishingAccount[] }> {
  const credentials = await resolvePublishingCredentials(userId, providerMode);
  if (!isRemotePublishingEnabled(credentials)) {
    throw new Error(getPublishingNotConfiguredMessage(providerMode));
  }

  const creds = credentials!;
  const provider = getPublishingProvider(creds.provider);
  const accounts = await provider.listAccounts({ credentials: creds });
  return { credentials: creds, accounts };
}

export function mapAccountToConnectedAccountRow(
  account: PublishingAccount,
  projectId: string
): {
  project_id: string;
  platform: GrowthSyncPlatform;
  handle: string;
  display_name: string;
  postbridge_account_id: string;
  postbridge_provider_id: string;
  status: "active" | "paused";
} | null {
  if (!isGrowthSyncPlatform(account.platform)) return null;

  const platform = normalizePublishingPlatform(account.platform) as GrowthSyncPlatform;
  const handle = account.profile ?? account.name;

  return {
    project_id: projectId,
    platform,
    handle,
    display_name: account.name,
    postbridge_account_id: account.id,
    postbridge_provider_id: account.platform,
    status: account.disabled ? "paused" : "active",
  };
}

export function mapAccountToChannelRow(
  account: PublishingAccount,
  ownerId: string,
  credentialSource: Exclude<PublishingCredentials["source"], "none">
): {
  owner_id: string;
  integration_id: string;
  provider: Exclude<PublishingCredentials["source"], "none">;
  platform: string;
  name: string;
  profile: string | null;
  disabled: boolean;
  raw_metadata: unknown;
  synced_at: string;
} {
  return {
    owner_id: ownerId,
    integration_id: account.id,
    provider: credentialSource,
    platform: normalizePublishingPlatform(account.platform),
    name: account.name,
    profile: account.profile,
    disabled: account.disabled,
    raw_metadata: account.raw,
    synced_at: new Date().toISOString(),
  };
}

export async function syncProjectConnectedAccounts(opts: {
  projectId: string;
  userId: string;
  providerMode: ProviderMode;
}): Promise<{ synced: number; provider: ReturnType<typeof getPublishingProviderId> }> {
  const { accounts } = await fetchPublishingAccounts(opts.userId, opts.providerMode);
  const rows = accounts.flatMap((account) => {
    const row = mapAccountToConnectedAccountRow(account, opts.projectId);
    return row ? [row] : [];
  });

  if (rows.length) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase
      .from("connected_accounts")
      .upsert(rows, { onConflict: "project_id,platform,handle", ignoreDuplicates: false });
    if (error) throw new Error(error.message);
  }

  return { synced: rows.length, provider: getPublishingProviderId() };
}

export async function syncOwnerPublishingChannels(opts: {
  ownerId: string;
  providerMode: ProviderMode;
}): Promise<{ synced: number; provider: ReturnType<typeof getPublishingProviderId> }> {
  const { credentials, accounts } = await fetchPublishingAccounts(opts.ownerId, opts.providerMode);
  const credentialSource = credentials.source === "none" ? "managed" : credentials.source;

  const rows = accounts.map((account) =>
    mapAccountToChannelRow(account, opts.ownerId, credentialSource)
  );

  if (rows.length) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("postbridge_channels").upsert(
      rows.map((row) => ({
        ...row,
        raw_metadata: row.raw_metadata as never,
      })),
      {
        onConflict: "owner_id,integration_id",
      }
    );
    if (error) throw new Error(error.message);
  }

  return { synced: rows.length, provider: getPublishingProviderId() };
}
