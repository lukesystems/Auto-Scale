import { AIError, type AIAdapter, type AdapterContext, type GenerateTextParams, type GenerateTextResult } from "../types";

export const anthropicAdapter: AIAdapter = {
  name: "anthropic",
  async generateText(params: GenerateTextParams, ctx: AdapterContext): Promise<GenerateTextResult> {
    const started = Date.now();
    const url = `${ctx.baseUrl ?? "https://api.anthropic.com/v1"}/messages`;
    const body = {
      model: params.model ?? "claude-3-5-sonnet-20241022",
      max_tokens: params.maxTokens ?? 2048,
      temperature: params.temperature ?? 0.6,
      system: params.system,
      messages: [{ role: "user", content: params.prompt }],
    };

    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key": ctx.apiKey,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    if (!response.ok) {
      const text = await response.text();
      throw new AIError(`Anthropic request failed (${response.status}): ${text}`, "anthropic");
    }

    const json = (await response.json()) as {
      content: { type: string; text: string }[];
      usage?: { input_tokens: number; output_tokens: number };
    };
    const text = json.content?.map((c) => c.text ?? "").join("") ?? "";

    return {
      text,
      provider: "anthropic",
      model: body.model,
      latencyMs: Date.now() - started,
      promptTokens: json.usage?.input_tokens,
      completionTokens: json.usage?.output_tokens,
      rawResponse: json,
    };
  },
};
