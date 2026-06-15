import type { ZodTypeAny, z } from "zod";

export type AIProvider = "openai" | "anthropic" | "gemini" | "openrouter" | "mock";

export interface AIMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface GenerateTextParams {
  provider?: AIProvider;
  model?: string;
  system?: string;
  prompt: string;
  temperature?: number;
  maxTokens?: number;
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
  system?: string;
  prompt: string;
  schema: T;
  schemaName?: string;
  schemaDescription?: string;
  temperature?: number;
  maxTokens?: number;
  /** Override the parser. Defaults to JSON.parse + zod schema. */
  fallback?: () => z.infer<T>;
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
