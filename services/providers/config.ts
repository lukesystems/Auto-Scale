import "server-only";

import type { ProviderMode } from "@/lib/provider-mode";
import { getDefaultProviderMode } from "@/lib/provider-mode";

export interface ManagedProviderConfig {
  mode: ProviderMode;
  openrouter: {
    apiKey: string | null;
    configured: boolean;
  };
  postiz: {
    apiUrl: string | null;
    apiKey: string | null;
    configured: boolean;
  };
  postBridge: {
    apiUrl: string | null;
    apiKey: string | null;
    configured: boolean;
  };
  publishingProvider: "postiz" | "postbridge";
  fal: {
    apiKey: string | null;
    configured: boolean;
    enabled: boolean;
  };
  models: {
    autobrief: string | null;
    trendwatch: string | null;
    discovery_reasoning: string | null;
    content: string | null;
    quality_gate: string | null;
    compound: string | null;
    default: string | null;
  };
  appUrl: string | null;
  appTitle: string;
}

export class ProviderSetupError extends Error {
  constructor(
    message: string,
    public readonly code: "openrouter_missing" | "postiz_missing" | "postbridge_missing" | "fal_missing"
  ) {
    super(message);
    this.name = "ProviderSetupError";
  }
}

function readEnv(key: string): string | null {
  const value = process.env[key]?.trim();
  return value ? value : null;
}

function readPublishingProvider(): "postiz" | "postbridge" {
  const configured = readEnv("PUBLISHING_PROVIDER");
  return configured?.toLowerCase() === "postbridge" ? "postbridge" : "postiz";
}

export function getManagedProviderConfig(): ManagedProviderConfig {
  const openrouterKey = readEnv("OPENROUTER_API_KEY");
  const postizUrl = readEnv("POSTIZ_API_URL");
  const postizKey = readEnv("POSTIZ_API_KEY");
  const postBridgeUrl = readEnv("POST_BRIDGE_API_URL");
  const postBridgeKey = readEnv("POST_BRIDGE_API_KEY");
  const falKey = readEnv("FAL_KEY");

  return {
    mode: getDefaultProviderMode(),
    publishingProvider: readPublishingProvider(),
    openrouter: {
      apiKey: openrouterKey,
      configured: Boolean(openrouterKey),
    },
    postiz: {
      apiUrl: postizUrl,
      apiKey: postizKey,
      configured: Boolean(postizUrl && postizKey),
    },
    postBridge: {
      apiUrl: postBridgeUrl,
      apiKey: postBridgeKey,
      configured: Boolean(postBridgeKey),
    },
    fal: {
      apiKey: falKey,
      configured: Boolean(falKey),
      enabled: false,
    },
    models: {
      autobrief: readEnv("AUTOSCALE_MODEL_AUTOBRIEF"),
      trendwatch: readEnv("AUTOSCALE_MODEL_TRENDWATCH"),
      discovery_reasoning: readEnv("AUTOSCALE_MODEL_DISCOVERY_REASONING"),
      content: readEnv("AUTOSCALE_MODEL_CONTENT"),
      quality_gate: readEnv("AUTOSCALE_MODEL_QUALITY_GATE"),
      compound: readEnv("AUTOSCALE_MODEL_COMPOUND"),
      default: readEnv("AUTOSCALE_MODEL_DEFAULT"),
    },
    appUrl: readEnv("NEXT_PUBLIC_APP_URL"),
    appTitle: "AutoScale",
  };
}

export function assertManagedOpenRouterConfigured(): void {
  const config = getManagedProviderConfig();
  if (!config.openrouter.configured) {
    throw new ProviderSetupError(
      "Managed OpenRouter is not configured. Set OPENROUTER_API_KEY on the server.",
      "openrouter_missing"
    );
  }
}

export function assertManagedPostizConfigured(): void {
  const config = getManagedProviderConfig();
  if (!config.postiz.configured) {
    throw new ProviderSetupError(
      "Managed Postiz is not configured. Set POSTIZ_API_URL and POSTIZ_API_KEY on the server.",
      "postiz_missing"
    );
  }
}

export function getManagedPostizCredentials(): { apiUrl: string; apiKey: string } | null {
  const config = getManagedProviderConfig();
  if (!config.postiz.configured || !config.postiz.apiUrl || !config.postiz.apiKey) {
    return null;
  }
  return { apiUrl: config.postiz.apiUrl, apiKey: config.postiz.apiKey };
}

export function assertManagedPostBridgeConfigured(): void {
  const config = getManagedProviderConfig();
  if (!config.postBridge.configured) {
    throw new ProviderSetupError(
      "Managed Post Bridge is not configured. Set POST_BRIDGE_API_KEY on the server.",
      "postbridge_missing"
    );
  }
}

export function getManagedPostBridgeCredentials(): { apiKey: string; apiUrl?: string } | null {
  const config = getManagedProviderConfig();
  if (!config.postBridge.configured || !config.postBridge.apiKey) {
    return null;
  }
  return {
    apiKey: config.postBridge.apiKey,
    apiUrl: config.postBridge.apiUrl ?? undefined,
  };
}

export function getManagedOpenRouterCredentials(): { apiKey: string; baseUrl: string } | null {
  const config = getManagedProviderConfig();
  if (!config.openrouter.configured || !config.openrouter.apiKey) {
    return null;
  }
  return { apiKey: config.openrouter.apiKey, baseUrl: "https://openrouter.ai/api/v1" };
}

/** Redact a secret for safe logging — never log full keys. */
export function redactSecret(value: string | null | undefined): string {
  if (!value) return "(not set)";
  if (value.length <= 8) return "****";
  return `${value.slice(0, 4)}…${value.slice(-4)}`;
}
