import type { ZodTypeAny, z } from "zod";

export type AIProvider = "openai" | "anthropic" | "openrouter";

export type AITaskType =
  | "autobrief"
  | "trendwatch"
  | "discovery_reasoning"
  | "videotrend_reasoning"
  | "hook_generation"
  | "strategy_generation"
  | "content"
  | "quality_gate"
  | "compound"
  | "default";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateTextParams {
  provider?: AIProvider;
  model?: string;
  taskType?: AITaskType;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
  /** "text" = normal prose (default); "json" = force JSON object where supported */
  responseMode?: "text" | "json";
}

export interface GenerateTextResult {
  text: string;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  promptTokens?: number;
  completionTokens?: number;
  costEstimate?: number;
  rawResponse?: unknown;
}

export interface GenerateObjectParams<T extends ZodTypeAny> {
  provider?: AIProvider;
  model?: string;
  taskType?: AITaskType;
  system?: string;
  prompt: string;
  schema: T;
  schemaName?: string;
  schemaDescription?: string;
  temperature?: number;
  maxTokens?: number;
}

export interface GenerateObjectResult<T extends ZodTypeAny> {
  object: z.infer<T>;
  raw: string;
  provider: AIProvider;
  model: string;
  latencyMs: number;
  retries: number;
  costEstimate?: number;
}

export interface AdapterContext {
  apiKey: string;
  baseUrl?: string;
  appUrl?: string | null;
  appTitle?: string;
  providerLabel?: AIProvider;
}

export interface AIAdapter {
  name: AIProvider;
  generateText(params: GenerateTextParams, ctx: AdapterContext): Promise<GenerateTextResult>;
}

export class AIError extends Error {
  constructor(message: string, public readonly provider: AIProvider, public readonly cause?: unknown) {
    super(message);
    this.name = "AIError";
  }
}
