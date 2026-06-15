import { AIError, type AIAdapter, type AdapterContext, type GenerateTextParams, type GenerateTextResult } from "../types";

export const openaiAdapter: AIAdapter = {
  name: "openai",
  async generateText(params: GenerateTextParams, ctx: AdapterContext): Promise<GenerateTextResult> {
    const started = Date.now();
    const provider = ctx.providerLabel ?? "openai";
    const url = `${ctx.baseUrl ?? "https://api.openai.com/v1"}/chat/completions`;
    const body = {
      model: params.model ?? "gpt-4o-mini",
      temperature: params.temperature ?? 0.6,
      max_tokens: params.maxTokens ?? 2048,
      response_format: { type: "json_object" as const },
      messages: [
        ...(params.system ? [{ role: "system" as const, content: params.system }] : []),
        { role: "user" as const, content: params.prompt },
      ],
    };

    const headers: Record<string, string> = {
      "Content-Type": "application/json",
      Authorization: `Bearer ${ctx.apiKey}`,
    };

    if (ctx.baseUrl?.includes("openrouter.ai")) {
      if (ctx.appUrl) headers["HTTP-Referer"] = ctx.appUrl;
      if (ctx.appTitle) headers["X-OpenRouter-Title"] = ctx.appTitle;
    }

    const response = await fetch(url, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new AIError(`${provider} request failed (${response.status}): ${text}`, provider);
    }

    const json = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";

    return {
      text,
      provider,
      model: body.model,
      latencyMs: Date.now() - started,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
      rawResponse: json,
    };
  },
};
