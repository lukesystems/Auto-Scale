import { z, type ZodTypeAny } from "zod";

import type {

  AIAdapter,

  AIProvider,

  AITaskType,

  GenerateObjectParams,

  GenerateObjectResult,

  GenerateTextParams,

  GenerateTextResult,

} from "./types";

import { AIError } from "./types";

import { openaiAdapter } from "./adapters/openai";

import { anthropicAdapter } from "./adapters/anthropic";

import { resolveModelForTask, resolveSafeStructuredModel, STRUCTURED_JSON_EMPTY_HINT } from "./model-router";

import { getManagedOpenRouterCredentials, getManagedProviderConfig, ProviderSetupError } from "@/services/providers/config";



const ADAPTERS: Record<AIProvider, AIAdapter> = {

  openai: openaiAdapter,

  anthropic: anthropicAdapter,

  openrouter: openaiAdapter, // OpenRouter speaks OpenAI's chat completions API

};



function defaultProvider(): AIProvider {

  const fromEnv = process.env.AUTOSCALE_AI_PROVIDER?.trim();

  if (fromEnv) {
    if (fromEnv in ADAPTERS) return fromEnv as AIProvider;
    throw new AIError(`Unsupported AI provider "${fromEnv}". Configure openrouter, openai, or anthropic.`, "openrouter");
  }

  if (getManagedOpenRouterCredentials()) return "openrouter";

  if (process.env.OPENAI_API_KEY) return "openai";

  if (process.env.ANTHROPIC_API_KEY) return "anthropic";

  throw new ProviderSetupError(
    "No AI provider is configured. Set OPENROUTER_API_KEY, OPENAI_API_KEY, or ANTHROPIC_API_KEY on the server.",
    "openrouter_missing"
  );

}



function defaultModel(provider: AIProvider, taskType: AITaskType = "default"): string {

  const routed = resolveModelForTask(taskType);

  if (routed) return routed;



  if (process.env.AUTOSCALE_DEFAULT_MODEL) return process.env.AUTOSCALE_DEFAULT_MODEL;

  switch (provider) {

    case "openai":

      return "gpt-4o-mini";

    case "anthropic":

      return "claude-3-5-sonnet-20241022";

    case "openrouter":

      return "openrouter/auto";

    default:
      return "openrouter/auto";

  }

}



function getCtx(provider: AIProvider) {

  const appConfig = getManagedProviderConfig();

  switch (provider) {

    case "openai":

      return {

        apiKey: process.env.OPENAI_API_KEY ?? "",

        providerLabel: "openai" as const,

      };

    case "anthropic":

      return {

        apiKey: process.env.ANTHROPIC_API_KEY ?? "",

        providerLabel: "anthropic" as const,

      };

    case "openrouter": {

      const creds = getManagedOpenRouterCredentials();

      return {

        apiKey: creds?.apiKey ?? process.env.OPENROUTER_API_KEY ?? "",

        baseUrl: creds?.baseUrl ?? "https://openrouter.ai/api/v1",

        appUrl: appConfig.appUrl,

        appTitle: appConfig.appTitle,

        providerLabel: "openrouter" as const,

      };

    }

    default:
      return {
        apiKey: "",
        providerLabel: provider,
      };

  }

}



export async function generateText(params: GenerateTextParams): Promise<GenerateTextResult> {

  const provider = params.provider ?? defaultProvider();

  const taskType = params.taskType ?? "default";

  let model = params.model ?? defaultModel(provider, taskType);
  const requestedModel = model;

  if (params.responseMode === "json") {
    model = resolveSafeStructuredModel(model, provider, taskType);
  }

  // #region agent log
  if (taskType === "autobrief") {
    fetch("http://127.0.0.1:7755/ingest/e9fc8964-ae23-4fa9-a7cb-b5541b636a4d", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "845232" },
      body: JSON.stringify({
        sessionId: "845232",
        hypothesisId: "H1-H3",
        location: "runtime.ts:generateText",
        message: "autobrief model resolution",
        data: { requestedModel, resolvedModel: model, provider, taskType, jsonMode: params.responseMode === "json" },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
  }
  // #endregion

  const adapter = ADAPTERS[provider];

  if (!adapter) throw new AIError(`Unknown provider: ${provider}`, provider);



  const ctx = getCtx(provider);

  if (!ctx.apiKey) {
    throw new ProviderSetupError(
      `${provider} is not configured. Set the required API key on the server before generating AI output.`,
      "openrouter_missing"
    );

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



  const taskType = params.taskType ?? "default";

  while (retries <= maxRetries) {

    const repairHint =
      retries > 0 && lastError
        ? `\n\nYour previous JSON did not match the contract. Correct every validation error below and return the COMPLETE object again:\n${lastError.message.slice(0, 6000)}`
        : "";

    const result = await generateText({

      provider: params.provider,

      model: params.model,

      taskType,

      system: fullSystem,

      prompt: params.prompt + repairHint + schemaHint,

      temperature: params.temperature ?? 0.5,

      maxTokens: params.maxTokens,

      responseMode: "json",

    });

    lastResult = result;

    if (!result.text.trim()) {
      throw new AIError(
        `AI provider returned empty response text. ${STRUCTURED_JSON_EMPTY_HINT}`,
        result.provider
      );
    }

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

      console.warn("[ai_runtime] structured output parse failed", {
        provider: result.provider,
        model: result.model,
        taskType,
        responseTextLength: result.text.length,
        responseTextPreview: result.text.slice(0, 300),
        retryCount: retries,
        parseError: lastError.message,
      });

      // #region agent log
      if (taskType === "autobrief") {
        let competitorSample: unknown = null;
        try {
          const parsed = JSON.parse(stripMarkdownFences(result.text)) as {
            suggested_competitors?: unknown;
          };
          competitorSample = parsed.suggested_competitors;
        } catch {
          competitorSample = "unparseable";
        }
        fetch("http://127.0.0.1:7755/ingest/e9fc8964-ae23-4fa9-a7cb-b5541b636a4d", {
          method: "POST",
          headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "845232" },
          body: JSON.stringify({
            sessionId: "845232",
            hypothesisId: "H4-H5",
            location: "runtime.ts:generateObject",
            message: "autobrief parse failed",
            data: {
              model: result.model,
              retryCount: retries,
              parseErrorPreview: lastError.message.slice(0, 400),
              competitorSample,
            },
            timestamp: Date.now(),
          }),
        }).catch(() => {});
      }
      // #endregion

      retries++;

    }

  }



  throw new AIError(

    `Failed to produce valid structured output after ${retries} retries: ${lastError?.message ?? "unknown"}`,

    lastResult?.provider ?? params.provider ?? "openrouter",

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



export { resolveModelForTask, getModelRoutingSummary } from "./model-router";
export { withProjectAIContext, getProjectModelFromContext } from "./project-context";
export { getProjectAIModelSlug } from "./load-project-model";


