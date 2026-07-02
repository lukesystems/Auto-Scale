import type { AIProvider, AITaskType } from "./types";
import { getManagedProviderConfig } from "@/services/providers/config";
import { getProjectModelFromContext } from "./project-context";
import { resolveOpenRouterModelSlug } from "./model-aliases";

export const STRUCTURED_JSON_TASK_TYPES: readonly AITaskType[] = [
  "autobrief",
  "trendwatch",
  "discovery_reasoning",
  "videotrend_reasoning",
  "hook_generation",
  "strategy_generation",
  "content",
  "quality_gate",
  "compound",
  "default",
];

export const STRUCTURED_JSON_EMPTY_HINT =
  "This model may not support JSON mode or may have hit max_tokens. Use a stable JSON-capable model for structured tasks.";

const UNSTABLE_STRUCTURED_JSON_MODEL_MARKERS = [
  ":free",
  "nex-agi/nex-r2-pro",
  // Produces valid JSON, but repeatedly ignores nested contracts and enum
  // casing on the Growth Run schemas. Keep it for prose; route structured
  // calls through the stable JSON model instead.
  "deepseek/deepseek-v4-pro",
  "deepseek/deepseek-chat",
] as const;

export function isStructuredJsonTask(taskType: AITaskType): boolean {
  return STRUCTURED_JSON_TASK_TYPES.includes(taskType);
}

export function isUnstableStructuredJsonModel(model: string): boolean {
  const normalized = model.trim().toLowerCase();
  return UNSTABLE_STRUCTURED_JSON_MODEL_MARKERS.some((marker) =>
    normalized.includes(marker.toLowerCase())
  );
}

export function getStableJsonFallbackModel(provider: AIProvider): string {
  switch (provider) {
    case "openrouter":
      return "openai/gpt-4o-mini";
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    default:
      return "gpt-4o-mini";
  }
}

export function resolveSafeStructuredModel(
  model: string,
  provider: AIProvider,
  taskType: AITaskType
): string {
  if (!isStructuredJsonTask(taskType) || !isUnstableStructuredJsonModel(model)) {
    return model;
  }

  const fallback = getStableJsonFallbackModel(provider);
  console.warn("[ai_model_router] unstable structured JSON model replaced", {
    taskType,
    provider,
    requestedModel: model,
    fallbackModel: fallback,
  });
  return fallback;
}

const TASK_ENV_MAP: Record<AITaskType, keyof ReturnType<typeof getManagedProviderConfig>["models"]> = {
  autobrief: "autobrief",
  trendwatch: "trendwatch",
  discovery_reasoning: "discovery_reasoning",
  videotrend_reasoning: "videotrend_reasoning",
  hook_generation: "hook_generation",
  strategy_generation: "strategy_generation",
  content: "content",
  quality_gate: "quality_gate",
  compound: "compound",
  default: "default",
};

export function resolveModelForTask(taskType: AITaskType = "default"): string | undefined {
  const projectModel = getProjectModelFromContext();
  if (projectModel?.trim()) {
    return resolveOpenRouterModelSlug(projectModel.trim()) ?? projectModel.trim();
  }

  const config = getManagedProviderConfig();
  const taskModel = config.models[TASK_ENV_MAP[taskType]];
  if (taskModel) return resolveOpenRouterModelSlug(taskModel) ?? taskModel;

  // Deep-reasoning falls back to the trendwatch model before the global default,
  // so the loop still routes to a capable model when no dedicated one is set.
  if (taskType === "discovery_reasoning" && config.models.trendwatch) {
    return config.models.trendwatch;
  }

  if (taskType === "videotrend_reasoning" && config.models.trendwatch) {
    return config.models.trendwatch;
  }

  if (taskType === "hook_generation" && config.models.content) {
    return config.models.content;
  }

  if (taskType === "strategy_generation" && config.models.content) {
    return config.models.content;
  }

  const fallback = config.models.default;
  if (fallback) return fallback;

  if (process.env.AUTOSCALE_DEFAULT_MODEL) {
    return resolveOpenRouterModelSlug(process.env.AUTOSCALE_DEFAULT_MODEL) ?? process.env.AUTOSCALE_DEFAULT_MODEL;
  }

  return undefined;
}

export function getModelRoutingSummary(): Record<AITaskType, string | null> {
  const config = getManagedProviderConfig();
  return {
    autobrief: config.models.autobrief ?? config.models.default,
    trendwatch: config.models.trendwatch ?? config.models.default,
    discovery_reasoning:
      config.models.discovery_reasoning ?? config.models.trendwatch ?? config.models.default,
    videotrend_reasoning:
      config.models.videotrend_reasoning ?? config.models.trendwatch ?? config.models.default,
    hook_generation: config.models.hook_generation ?? config.models.content ?? config.models.default,
    strategy_generation:
      config.models.strategy_generation ?? config.models.content ?? config.models.default,
    content: config.models.content ?? config.models.default,
    quality_gate: config.models.quality_gate ?? config.models.default,
    compound: config.models.compound ?? config.models.default,
    default: config.models.default,
  };
}
