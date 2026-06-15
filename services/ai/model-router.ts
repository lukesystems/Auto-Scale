import type { AITaskType } from "./types";
import { getManagedProviderConfig } from "@/services/providers/config";

const TASK_ENV_MAP: Record<AITaskType, keyof ReturnType<typeof getManagedProviderConfig>["models"]> = {
  autobrief: "autobrief",
  trendwatch: "trendwatch",
  content: "content",
  quality_gate: "quality_gate",
  compound: "compound",
  default: "default",
};

export function resolveModelForTask(taskType: AITaskType = "default"): string | undefined {
  const config = getManagedProviderConfig();
  const taskModel = config.models[TASK_ENV_MAP[taskType]];
  const fallback = config.models.default;

  if (taskModel) return taskModel;
  if (fallback) return fallback;

  if (process.env.AUTOSCALE_DEFAULT_MODEL) {
    return process.env.AUTOSCALE_DEFAULT_MODEL;
  }

  return undefined;
}

export function getModelRoutingSummary(): Record<AITaskType, string | null> {
  const config = getManagedProviderConfig();
  return {
    autobrief: config.models.autobrief ?? config.models.default,
    trendwatch: config.models.trendwatch ?? config.models.default,
    content: config.models.content ?? config.models.default,
    quality_gate: config.models.quality_gate ?? config.models.default,
    compound: config.models.compound ?? config.models.default,
    default: config.models.default,
  };
}
