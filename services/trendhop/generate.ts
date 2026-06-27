import "server-only";
import { generateObject } from "@/services/ai/runtime";
import {
  TrendHopListSchema,
  type DiscoveredTrendCandidate,
  type TrendHopList,
} from "./schema";

interface ProductContext {
  productName: string | null;
  productSummary: string | null;
  targetCustomer: string | null;
  niche: string | null;
  cta: string | null;
}

const SYSTEM = `You are AutoScale TrendHop. You scan today's trending short-form content and propose how a specific product can hop on each trend with a video that organically promotes it.

Rules:
- Each hop must reference at least one real URL from the provided trend candidates.
- Be specific. Avoid generic "post on TikTok" advice.
- Tie every suggested concept to the product's audience, pain, or promise.
- Never invent metrics. If you don't know a creator's stats, don't claim them.
- Recency_score reflects how fresh the trend feels (1.0 = breaking, 0.3 = stale but still active).
- Confidence reflects how confident you are that this product can credibly join the trend.
- Return ONLY hops where confidence > 0.35.`;

export interface GenerateTrendHopsInput {
  product: ProductContext;
  candidates: DiscoveredTrendCandidate[];
}

export async function generateTrendHops(
  input: GenerateTrendHopsInput
): Promise<{
  hops: TrendHopList["hops"];
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const candidateBlock = input.candidates.slice(0, 30).map((c, i) =>
    `[${i + 1}] ${c.platform} ${c.publishedAt ?? ""}
URL: ${c.url}
Title: ${c.title ?? "(none)"}
Snippet: ${c.snippet ?? "(none)"}`
  ).join("\n\n");

  const prompt = `[[trendhop]]
Product: ${input.product.productName ?? "(unknown)"}
Summary: ${input.product.productSummary ?? "(unknown)"}
Target customer: ${input.product.targetCustomer ?? "(unknown)"}
Niche: ${input.product.niche ?? "(unknown)"}
Preferred CTA: ${input.product.cta ?? "(none)"}

Trend candidates (pick the ones that this product can credibly hop on, group similar ones into a single trend):

${candidateBlock || "(no candidates available — return an empty hops array)"}

Produce up to 8 trend hops. Each must include:
- platform, trend_name, why_hot (1-2 sentences)
- references (1-4 URLs taken from candidate list above; you may include the same URL across hops only if relevant)
- product_angle (how this specific product organically fits)
- suggested_hook (one line, spoken or on-screen)
- suggested_concept (3-6 sentence video concept)
- recency_score (0-1)
- confidence (0-1)`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: TrendHopListSchema,
    schemaName: "TrendHopList",
    taskType: "default",
    temperature: 0.6,
    maxTokens: 4500,
  });

  return {
    hops: result.object.hops,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}
