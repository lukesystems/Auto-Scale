import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { isManagedMode } from "@/lib/provider-mode";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { ConnectedPublishingAccount, PublishingCredentials } from "./provider";
import {
  getPublishingProvider,
  getPublishingProviderId,
  isPublishingConfigured,
  resolvePublishingCredentials,
} from "./resolver";

export const GROWTH_SYNC_PLATFORMS = ["tiktok", "instagram", "youtube"] as const;
export type GrowthSyncPlatform = (typeof GROWTH_SYNC_PLATFORMS)[number];

export function normalizePublishingPlatform(platform: string): string {
  const key = platform.toLowerCase().replace(/[^a-z0-9-]/g, "");
  if (key === "x" || key.includes("twitter")) return "x";
  return key;
}

export function isGrowthSyncPlatform(platform: string): platform is GrowthSyncPlatform {
  const normalized = normalizePublishingPlatform(platform);
  return (GROWTH_SYNC_PLATFORMS as readonly string[]).includes(normalized);
}

export function getPublishingProviderLabel(
  providerId = getPublishingProviderId()
): "Postiz" | "Post Bridge" {
  return providerId === "postbridge" ? "Post Bridge" : "Postiz";
}

export function getPublishingNotConfiguredMessage(
  providerMode: ProviderMode,
  providerId = getPublishingProviderId()
): string {
  if (providerId === "postbridge") {
    return isManagedMode(providerMode)
      ? "Post Bridge is not connected. Set POST_BRIDGE_API_KEY on the server (managed mode)."
      : "Post Bridge is not connected. Connect Post Bridge in Settings (BYOK).";
  }

  return isManagedMode(providerMode)
    ? "Postiz is not connected. Add POSTIZ_API_URL + POSTIZ_API_KEY (managed) or connect Postiz in Settings (BYOK)."
    : "Postiz is not connected. Connect Postiz in Settings (BYOK).";
}

export async function fetchPublishingAccounts(
  userId: string,
  providerMode: ProviderMode
): Promise<{ credentials: PublishingCredentials; accounts: ConnectedPublishingAccount[] }> {
  const credentials = await resolvePublishingCredentials(userId, providerMode);
  if (!isPublishingConfigured(credentials)) {
    throw new Error(getPublishingNotConfiguredMessage(providerMode));
  }

  const provider = getPublishingProvider(credentials.provider);
  const accounts = await provider.listConnectedAccounts(credentials);
  return { credentials, accounts };
}

export function mapAccountToConnectedAccountRow(
  account: ConnectedPublishingAccount,
  projectId: string
): {
  project_id: string;
  platform: GrowthSyncPlatform;
  handle: string;
  display_name: string;
  postiz_account_id: string;
  postiz_provider_id: string;
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
    postiz_account_id: account.id,
    postiz_provider_id: account.platform,
    status: account.disabled ? "paused" : "active",
  };
}

export function mapAccountToChannelRow(
  account: ConnectedPublishingAccount,
  ownerId: string,
  credentialSource: PublishingCredentials["source"]
): {
  owner_id: string;
  integration_id: string;
  provider: PublishingCredentials["source"];
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
  const rows = accounts.map((account) =>
    mapAccountToChannelRow(account, opts.ownerId, credentials.source)
  );

  if (rows.length) {
    const supabase = createSupabaseServerClient();
    const { error } = await supabase.from("postiz_channels").upsert(
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
