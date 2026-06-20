import { AIError, type AIAdapter, type AdapterContext, type GenerateTextParams, type GenerateTextResult } from "../types";
import { STRUCTURED_JSON_EMPTY_HINT } from "../model-router";

const DEFAULT_TIMEOUT_MS = 90_000;

function getRequestTimeoutMs(): number {
  const raw = process.env.AI_REQUEST_TIMEOUT_MS?.trim();
  if (!raw) return DEFAULT_TIMEOUT_MS;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : DEFAULT_TIMEOUT_MS;
}

export const openaiAdapter: AIAdapter = {
  name: "openai",

  async generateText(params: GenerateTextParams, ctx: AdapterContext): Promise<GenerateTextResult> {
    const started = Date.now();
    const provider = ctx.providerLabel ?? "openai";
    const url = `${ctx.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`;
    const responseMode = params.responseMode ?? "text";

    const body: Record<string, unknown> = {
      model: params.model ?? "gpt-4o-mini",
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

    if (ctx.baseUrl?.includes("openrouter.ai")) {
      if (ctx.appUrl) headers["HTTP-Referer"] = ctx.appUrl;
      if (ctx.appTitle) headers["X-OpenRouter-Title"] = ctx.appTitle;
    }

    const timeoutMs = getRequestTimeoutMs();
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);

    let response: Response;
    try {
      response = await fetch(url, {
        method: "POST",
        headers,
        body: JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (err) {
      if (err instanceof Error && err.name === "AbortError") {
        throw new AIError(
          `AI request timed out after ${timeoutMs}ms. Try a faster model or check provider status.`,
          provider
        );
      }
      throw new AIError(`${provider} request failed: ${err instanceof Error ? err.message : "unknown error"}`, provider, err);
    } finally {
      clearTimeout(timeoutId);
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
