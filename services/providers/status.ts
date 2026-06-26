import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { getManagedProviderConfig } from "./config";
import { getPublishingProviderId } from "@/services/social-publishing/resolver";
import { getPublishingProviderLabel } from "@/services/social-publishing/sync-accounts";

export interface ProviderStatus {
  mode: ProviderMode;
  openrouter: {
    configured: boolean;
    modelDefaults: {
      autobrief: string | null;
      trendwatch: string | null;
      content: string | null;
      quality_gate: string | null;
      compound: string | null;
      default: string | null;
    };
  };
  publishing: {
    provider: "postiz" | "postbridge" | "export_only";
    label: "Postiz" | "Post Bridge" | "Export";
    configured: boolean;
    remoteEnabled: boolean;
  };
  postiz: {
    configured: boolean;
    apiUrlConfigured: boolean;
  };
  postbridge: {
    configured: boolean;
    enabled: boolean;
  };
  fal: {
    configured: boolean;
    enabled: boolean;
  };
  warnings: string[];
}

export function getProviderStatus(mode: ProviderMode): ProviderStatus {
  const config = getManagedProviderConfig();
  const warnings: string[] = [];
  const publishingProvider = getPublishingProviderId();
  const publishingLabel = getPublishingProviderLabel(publishingProvider);
  const postizConfigured = config.postiz.configured;
  const postBridgeConfigured = config.postBridge.configured;
  const publishingConfigured =
    publishingProvider === "export_only"
      ? true
      : publishingProvider === "postbridge"
        ? false
        : postizConfigured;
  const remoteEnabled = publishingProvider === "postiz" && postizConfigured;

  if (mode === "managed") {
    if (!config.openrouter.configured) {
      warnings.push(
        "Managed OpenRouter is not configured. AI generation will fail until OPENROUTER_API_KEY is set."
      );
    }
    if (publishingProvider === "postiz" && !postizConfigured) {
      warnings.push(
        "Managed Postiz is not configured. Scheduling will queue locally until POSTIZ_API_URL and POSTIZ_API_KEY are set."
      );
    }
    if (publishingProvider === "postbridge") {
      warnings.push(
        "Post Bridge adapter is stubbed. Scheduling queues locally until the Post Bridge integration is confirmed."
      );
    }
  }

  return {
    mode,
    openrouter: {
      configured: config.openrouter.configured,
      modelDefaults: config.models,
    },
    publishing: {
      provider: publishingProvider,
      label: publishingLabel,
      configured: publishingConfigured,
      remoteEnabled,
    },
    postiz: {
      configured: postizConfigured,
      apiUrlConfigured: Boolean(config.postiz.apiUrl),
    },
    postbridge: {
      configured: postBridgeConfigured,
      enabled: false,
    },
    fal: {
      configured: config.fal.configured,
      enabled: config.fal.enabled,
    },
    warnings,
  };
}

/** Client-safe JSON — never includes API keys. */
export function getClientSafeProviderStatus(mode: ProviderMode): ProviderStatus {
  return getProviderStatus(mode);
}
