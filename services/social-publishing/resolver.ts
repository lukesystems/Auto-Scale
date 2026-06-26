import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { isManagedMode } from "@/lib/provider-mode";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { exportPublishingProvider } from "./export-provider";
import { postBridgePublishingProvider } from "./postbridge-provider";
import { postizPublishingProvider } from "./postiz-provider";
import type { PublishingCredentials, PublishingProvider, PublishingProviderName } from "./provider";

const PROVIDERS: Record<PublishingProviderName, PublishingProvider> = {
  postiz: postizPublishingProvider,
  postbridge: postBridgePublishingProvider,
  export_only: exportPublishingProvider,
};

export function getPublishingProviderId(): PublishingProviderName {
  const configured = (process.env.PUBLISHING_PROVIDER ?? "postiz").trim().toLowerCase();
  if (configured === "postbridge") return "postbridge";
  if (configured === "export_only") return "export_only";
  return "postiz";
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
  if (providerId === "export_only") {
    return { provider: "export_only", source: "none" };
  }

  if (providerId === "postbridge") {
    // Stub sprint: credentials are not resolved until Post Bridge is confirmed.
    return null;
  }

  const postiz = await resolvePostizCredentials(userId, providerMode);
  if (!postiz) return null;
  return {
    provider: "postiz",
    apiUrl: postiz.apiUrl,
    apiKey: postiz.apiKey,
    source: postiz.source,
  };
}

/** True when the active provider can participate in the publishing flow (including export-only). */
export function isPublishingConfigured(
  credentials: PublishingCredentials | null | undefined
): credentials is PublishingCredentials {
  if (!credentials) return false;
  if (credentials.provider === "export_only") return true;
  if (credentials.provider === "postbridge") return false;
  if (credentials.provider === "postiz") {
    return Boolean(credentials.apiUrl?.trim() && credentials.apiKey?.trim());
  }
  return false;
}

/** True when the provider should make remote API scheduling/status calls. */
export function isRemotePublishingEnabled(
  credentials: PublishingCredentials | null | undefined
): boolean {
  if (!credentials) return false;
  if (credentials.provider !== "postiz") return false;
  return Boolean(credentials.apiUrl?.trim() && credentials.apiKey?.trim());
}
