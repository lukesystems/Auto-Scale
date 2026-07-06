import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { resolvePostBridgeCredentials } from "@/lib/postbridge-credentials";
import { postBridgePublishingProvider } from "./postbridge-provider";
import type { PublishingCredentials, PublishingProvider, PublishingProviderName } from "./provider";

const PROVIDERS: Record<PublishingProviderName, PublishingProvider> = {
  postbridge: postBridgePublishingProvider,
};

export function getPublishingProviderId(): PublishingProviderName {
  return "postbridge";
}

export function getPublishingProvider(
  providerId: PublishingProviderName = getPublishingProviderId()
): PublishingProvider {
  return PROVIDERS[providerId];
}

export async function resolvePublishingCredentials(
  userId: string,
  providerMode: ProviderMode,
  providerId: PublishingProviderName = getPublishingProviderId()
): Promise<PublishingCredentials | null> {
  const postBridge = await resolvePostBridgeCredentials(userId, providerMode);
  if (!postBridge) return null;
  return {
    provider: "postbridge",
    apiKey: postBridge.apiKey,
    apiUrl: postBridge.apiUrl,
    source: postBridge.source,
  };
}

/** True when the active provider can participate in the publishing flow (including export-only). */
export function isPublishingConfigured(
  credentials: PublishingCredentials | null | undefined
): credentials is PublishingCredentials {
  if (!credentials) return false;
  return Boolean(credentials.apiKey?.trim());
}

/** True when the provider should make remote API scheduling/status calls. */
export function isRemotePublishingEnabled(
  credentials: PublishingCredentials | null | undefined
): boolean {
  if (!credentials) return false;
  return Boolean(credentials.apiKey?.trim());
}
