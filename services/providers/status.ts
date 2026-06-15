import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { getManagedProviderConfig } from "./config";

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
  postiz: {
    configured: boolean;
    apiUrlConfigured: boolean;
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

  if (mode === "managed") {
    if (!config.openrouter.configured) {
      warnings.push(
        "Managed OpenRouter is not configured. AI will fall back to mock provider until OPENROUTER_API_KEY is set."
      );
    }
    if (!config.postiz.configured) {
      warnings.push(
        "Managed Postiz is not configured. Scheduling will queue locally until POSTIZ_API_URL and POSTIZ_API_KEY are set."
      );
    }
  }

  return {
    mode,
    openrouter: {
      configured: config.openrouter.configured,
      modelDefaults: config.models,
    },
    postiz: {
      configured: config.postiz.configured,
      apiUrlConfigured: Boolean(config.postiz.apiUrl),
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
