import { generateObject } from "@/services/ai/runtime";
import { TrendWatchAnalysisSchema, type TrendWatchAnalysis } from "./schema";

export interface TrendWatchInput {
  projectName: string;
  niche?: string;
  productSummary?: string;
  targetCustomer?: string;
  primaryPain?: string;
  competitors?: string[];
  sources?: Array<{
    url?: string;
    platform?: string;
    handle?: string;
    notes?: string;
  }>;
}

const SYSTEM = `You are AutoScale's TrendWatch engine. You reverse-engineer what already works in a startup's niche.

Rules:
- Never invent fake metrics or made-up creators.
- Prefer transferable patterns over celebrity-creator content.
- Flag follower distortion explicitly.
- Tag formats specifically (e.g., "problem-solution carousel", "tool teardown", "before/after workflow").
- Always return JSON matching the requested schema.`;

export async function runTrendWatchAnalysis(input: TrendWatchInput): Promise<{
  analysis: TrendWatchAnalysis;
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const sourceLines = (input.sources ?? [])
    .slice(0, 30)
    .map((s, i) => `  ${i + 1}. ${s.platform ?? "?"} @${s.handle ?? "?"} — ${s.url ?? ""} ${s.notes ? `(${s.notes})` : ""}`)
    .join("\n");

  const prompt = `[[trendwatch_analysis]]
Project: ${input.projectName}
Niche: ${input.niche ?? "(not provided)"}
Product summary: ${input.productSummary ?? "(not provided)"}
Target customer: ${input.targetCustomer ?? "(not provided)"}
Primary pain: ${input.primaryPain ?? "(not provided)"}
Competitors: ${(input.competitors ?? []).join(", ") || "(not provided)"}

Provided sources:
${sourceLines || "  (none — analyze the niche from public knowledge)"}

Produce a TrendWatch analysis that:
- Summarizes the niche in 2-4 sentences
- Maps competitors (strength/weakness/account_type each)
- Lists 3-6 shadow account targets the founder should study
- Identifies 3-6 winning formats with one-line reasons
- Surfaces 6-12 hook opportunities specific to the niche
- Recommends 3-6 concrete experiments
- Flags 2-5 risks (distortion, false signals, brittle patterns)`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: TrendWatchAnalysisSchema,
    schemaName: "TrendWatchAnalysis",
    temperature: 0.55,
  });

  return {
    analysis: result.object,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}
