import { AIError, type AIAdapter, type AdapterContext, type GenerateTextParams, type GenerateTextResult } from "../types";
import { STRUCTURED_JSON_EMPTY_HINT } from "../model-router";

const DEFAULT_TIMEOUT_MS = 90_000;
const MAX_REQUEST_ATTEMPTS = 3;

function getRequestTimeoutMs(): number {
  const raw = process.env.AI_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

function getRetryDelayMs(attempt: number): number {
  const configured = Number.parseInt(process.env.AI_RETRY_BASE_DELAY_MS ?? "750", 10);
  const base = Number.isFinite(configured) && configured >= 0 ? configured : 750;
  return base * 2 ** attempt;
}

function isRetryableStatus(status: number): boolean {
  return status === 408 || status === 409 || status === 429 || status >= 500;
}

export const openRouterAdapter: AIAdapter = {
  name: "openrouter",

  async generateText(params: GenerateTextParams, ctx: AdapterContext): Promise<GenerateTextResult> {
    const started = Date.now();
    const provider = "openrouter";
    const url = `${ctx.baseUrl ?? "https://openrouter.ai/api/v1"}/chat/completions`;
    const responseMode = params.responseMode ?? "text";

    const body: Record<string, unknown> = {
      model: params.model ?? "openrouter/auto",
      temperature: params.temperature ?? 0.6,
      max_tokens: params.maxTokens ?? 2048,
      messages: [
        ...(params.system ? [{ role: "system" as const, content: params.system }] : []),
        { role: "user" as const, content: params.prompt },
      ],
    };

    if (responseMode === "json") {
      body.response_format = { type: "json_object" as const };
    }

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.apiKey}`,
    };

    if (ctx.appUrl) headers["HTTP-Referer"] = ctx.appUrl;
    if (ctx.appTitle) headers["X-OpenRouter-Title"] = ctx.appTitle;

    const timeoutMs = getRequestTimeoutMs();
    let response: Response | null = null;
    let lastError: unknown = null;

    for (let attempt = 0; attempt < MAX_REQUEST_ATTEMPTS; attempt++) {
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
      try {
        const candidate = await fetch(url, {
          method: "POST",
          headers,
          body: JSON.stringify(body),
          signal: controller.signal,
        });
        if (candidate.ok || !isRetryableStatus(candidate.status)) {
          response = candidate;
          break;
        }
        lastError = new AIError(
          `${provider} request returned retryable status ${candidate.status}`,
          provider
        );
      } catch (err) {
        lastError = err;
      } finally {
        clearTimeout(timeoutId);
      }

      if (attempt < MAX_REQUEST_ATTEMPTS - 1) {
        console.warn("[ai_adapter] retrying provider request", {
          provider,
          model: body.model,
          attempt: attempt + 1,
        });
        await new Promise((resolve) => setTimeout(resolve, getRetryDelayMs(attempt)));
      }
    }

    if (!response) {
      if (lastError instanceof Error && lastError.name === "AbortError") {
        throw new AIError(
          `AI request timed out after ${MAX_REQUEST_ATTEMPTS} attempts of ${timeoutMs}ms. Try a faster model or check provider status.`,
          provider,
          lastError
        );
      }
      throw new AIError(
        `${provider} request failed after ${MAX_REQUEST_ATTEMPTS} attempts: ${lastError instanceof Error ? lastError.message : "unknown error"}`,
        provider,
        lastError
      );
    }

    if (!response.ok) {
      const text = await response.text();
      throw new AIError(`${provider} request failed (${response.status}): ${text}`, provider);
    }

    const json = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";

    if (!text.trim()) {
      const usage = json.usage;
      throw new AIError(
        `${provider} returned empty message content (status ${response.status}, model ${body.model as string}, usage: prompt=${usage?.prompt_tokens ?? "n/a"}, completion=${usage?.completion_tokens ?? "n/a"}). ${STRUCTURED_JSON_EMPTY_HINT}`,
        provider
      );
    }

    return {
      text,
      provider,
      model: body.model as string,
      latencyMs: Date.now() - started,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
      rawResponse: json,
    };
  },
};
