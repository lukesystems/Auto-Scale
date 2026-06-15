import { AIError, type AIAdapter, type AdapterContext, type GenerateTextParams, type GenerateTextResult } from "../types";

export const openaiAdapter: AIAdapter = {
  name: "openai",
  async generateText(params: GenerateTextParams, ctx: AdapterContext): Promise<GenerateTextResult> {
    const started = Date.now();
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

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ctx.apiKey}`,
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new AIError(`OpenAI request failed (${response.status}): ${text}`, "openai");
    }

    const json = (await response.json()) as {
      choices: { message: { content: string } }[];
      usage?: { prompt_tokens: number; completion_tokens: number };
    };
    const text = json.choices?.[0]?.message?.content ?? "";

    return {
      text,
      provider: "openai",
      model: body.model,
      latencyMs: Date.now() - started,
      promptTokens: json.usage?.prompt_tokens,
      completionTokens: json.usage?.completion_tokens,
      rawResponse: json,
    };
  },
};
