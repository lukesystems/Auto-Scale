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
    provider: "postbridge";
    label: "Post Bridge";
    configured: boolean;
    remoteEnabled: boolean;
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
  const postBridgeConfigured = config.postBridge.configured;

  if (mode === "managed") {
    if (!config.openrouter.configured) {
      warnings.push(
        "Managed OpenRouter is not configured. AI generation will fail until OPENROUTER_API_KEY is set."
      );
    }
    if (!postBridgeConfigured) {
      warnings.push(
        "Managed Post Bridge is not configured. Scheduling will fail until POST_BRIDGE_API_KEY is set."
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
      configured: postBridgeConfigured,
      remoteEnabled: postBridgeConfigured,
    },
    postbridge: {
      configured: postBridgeConfigured,
      enabled: postBridgeConfigured,
    },
    fal: {
      configured: config.fal.configured,
      enabled: config.fal.enabled,
    },
    warnings,
  };
}

export function getClientSafeProviderStatus(mode: ProviderMode): ProviderStatus {
  return getProviderStatus(mode);
}
