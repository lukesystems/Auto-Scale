import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { resolvePostBridgeCredentials } from "@/lib/postbridge-credentials";
import { resolvePostizCredentials } from "@/lib/postiz-credentials";
import { postBridgePublishingProvider } from "./postbridge-provider";
import { postizPublishingProvider } from "./postiz-provider";
import type { PublishingCredentials, PublishingProviderId, SocialPublishingProvider } from "./provider";

const PROVIDERS: Record<PublishingProviderId, SocialPublishingProvider> = {
  postiz: postizPublishingProvider,
  postbridge: postBridgePublishingProvider,
};

export function getPublishingProviderId(): PublishingProviderId {
  const configured = (process.env.PUBLISHING_PROVIDER ?? "postiz").trim().toLowerCase();
  if (configured === "postbridge") return "postbridge";
  return "postiz";
}

export function getPublishingProvider(
  providerId: PublishingProviderId = getPublishingProviderId()
): SocialPublishingProvider {
  return PROVIDERS[providerId];
}

export async function resolvePublishingCredentials(
  userId: string,
  providerMode: ProviderMode,
  providerId: PublishingProviderId = getPublishingProviderId()
): Promise<PublishingCredentials | null> {
  if (providerId === "postbridge") {
    const postBridge = await resolvePostBridgeCredentials(userId, providerMode);
    if (!postBridge) return null;
    return {
      provider: "postbridge",
      apiKey: postBridge.apiKey,
      source: postBridge.source,
    };
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

export function isPublishingConfigured(
  credentials: PublishingCredentials | null | undefined
): credentials is PublishingCredentials {
  if (!credentials) return false;
  if (credentials.provider === "postiz") {
    return Boolean(credentials.apiUrl?.trim() && credentials.apiKey?.trim());
  }
  return Boolean(credentials.apiKey?.trim());
}
