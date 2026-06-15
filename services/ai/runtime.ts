import { z, type ZodTypeAny } from "zod";
import type {
  AIAdapter,
  AIProvider,
  GenerateObjectParams,
  GenerateObjectResult,
  GenerateTextParams,
  GenerateTextResult,
} from "./types";
import { AIError } from "./types";
import { mockAdapter } from "./adapters/mock";
import { openaiAdapter } from "./adapters/openai";
import { anthropicAdapter } from "./adapters/anthropic";

const ADAPTERS: Record<AIProvider, AIAdapter> = {
  mock: mockAdapter,
  openai: openaiAdapter,
  anthropic: anthropicAdapter,
  gemini: openaiAdapter, // placeholder until Gemini adapter lands
  openrouter: openaiAdapter, // OpenRouter speaks OpenAI's chat completions API
};

function defaultProvider(): AIProvider {
  const fromEnv = process.env.AUTOSCALE_DEFAULT_PROVIDER as AIProvider | undefined;
  if (fromEnv && ADAPTERS[fromEnv]) return fromEnv;
  if (process.env.OPENAI_API_KEY) return "openai";
  if (process.env.ANTHROPIC_API_KEY) return "anthropic";
  if (process.env.OPENROUTER_API_KEY) return "openrouter";
  return "mock";
}

function defaultModel(provider: AIProvider): string {
  if (process.env.AUTOSCALE_DEFAULT_MODEL) return process.env.AUTOSCALE_DEFAULT_MODEL;
  switch (provider) {
    case "openai":
      return "gpt-4o-mini";
    case "anthropic":
      return "claude-3-5-sonnet-20241022";
    case "openrouter":
      return "openrouter/auto";
    case "gemini":
      return "gemini-1.5-flash";
    case "mock":
    default:
      return "mock-default";
  }
}

function getCtx(provider: AIProvider) {
  switch (provider) {
    case "openai":
      return { apiKey: process.env.OPENAI_API_KEY ?? "" };
    case "anthropic":
      return { apiKey: process.env.ANTHROPIC_API_KEY ?? "" };
    case "openrouter":
      return { apiKey: process.env.OPENROUTER_API_KEY ?? "", baseUrl: "https://openrouter.ai/api/v1" };
    case "gemini":
      return { apiKey: process.env.GOOGLE_API_KEY ?? "" };
    case "mock":
    default:
      return { apiKey: "mock" };
  }
}

export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {
  const provider = params.provider ?? defaultProvider();
  const model = params.model ?? defaultModel(provider);
  const adapter = ADAPTERS[provider];
  if (!adapter) throw new AIError(`Unknown provider: ${provider}`, provider);

  const ctx = getCtx(provider);
  if (provider !== "mock" && !ctx.apiKey) {
    // Soft-fall back to mock so the app stays usable without keys.
    return mockAdapter.generateText({ ...params, provider: "mock", model: "mock-default" }, { apiKey: "mock" });
  }

  return adapter.generateText({ ...params, model }, ctx);
}

export async function generateObject<T extends ZodTypeAny>(
  params: GenerateObjectParams<T>
): Promise<GenerateObjectResult<T>> {
  let retries = 0;
  const maxRetries = 1;
  let lastError: Error | null = null;
  let lastResult: GenerateTextResult | null = null;

  const schemaHint = params.schemaDescription
    ? `\n\nReturn ONLY a JSON object that matches this contract:\n${params.schemaDescription}`
    : "\n\nReturn ONLY a single JSON object. No prose, no markdown fences.";

  const fullSystem = [
    params.system,
    "You are a strict JSON generator. Always return valid JSON matching the requested schema. Never wrap in markdown.",
  ]
    .filter(Boolean)
    .join("\n\n");

  while (retries <= maxRetries) {
    const result = await generateText({
      provider: params.provider,
      model: params.model,
      system: fullSystem,
      prompt: params.prompt + (retries > 0 ? "\n\nYour last response was not valid JSON. Try again." : "") + schemaHint,
      temperature: params.temperature ?? 0.5,
      maxTokens: params.maxTokens,
    });
    lastResult = result;

    const text = stripMarkdownFences(result.text);
    try {
      const parsed: unknown = JSON.parse(text);
      const validated = params.schema.parse(parsed) as z.infer<T>;
      return {
        object: validated,
        raw: result.text,
        provider: result.provider,
        model: result.model,
        latencyMs: result.latencyMs,
        retries,
        costEstimate: result.costEstimate,
      };
    } catch (err) {
      lastError = err instanceof Error ? err : new Error(String(err));
      retries++;
    }
  }

  if (params.fallback) {
    return {
      object: params.fallback(),
      raw: lastResult?.text ?? "",
      provider: lastResult?.provider ?? "mock",
      model: lastResult?.model ?? "mock-default",
      latencyMs: lastResult?.latencyMs ?? 0,
      retries,
    };
  }

  throw new AIError(
    `Failed to produce valid structured output after ${retries} retries: ${lastError?.message ?? "unknown"}`,
    lastResult?.provider ?? "mock",
    lastError
  );
}

function stripMarkdownFences(text: string): string {
  const trimmed = text.trim();
  if (trimmed.startsWith("```")) {
    return trimmed.replace(/^```(?:json)?\s*/i, "").replace(/```\s*$/i, "").trim();
  }
  return trimmed;
}

export function listProviders(): AIProvider[] {
  return Object.keys(ADAPTERS) as AIProvider[];
}

export function getDefaultProvider(): AIProvider {
  return defaultProvider();
}
