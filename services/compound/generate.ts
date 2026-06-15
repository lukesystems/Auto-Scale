import { generateObject } from "@/services/ai/runtime";
import { VariantsSchema, WinnerDiagnosisSchema, type Variants, type WinnerDiagnosis } from "./schema";

const SYSTEM = `You are AutoScale's Compound Engine. You turn winners into more winners.

Rules:
- Be specific. Tie every learning to the actual hook/format/audience that worked.
- Variants should diverge meaningfully — different angle, audience, or framing.
- Never repeat the winning hook verbatim. Each variant must be distinct.
- Return JSON matching the requested schema.`;

export interface WinnerDiagnosisInput {
  hook: string;
  format?: string;
  angle?: string;
  audience?: string;
  cta?: string;
  metrics?: {
    views?: number;
    saves?: number;
    shares?: number;
    comments?: number;
    clicks?: number;
    signups?: number;
    revenue?: number;
  };
  notes?: string;
}

export async function diagnoseWinner(input: WinnerDiagnosisInput): Promise<{
  diagnosis: WinnerDiagnosis;
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const metricsLine = input.metrics
    ? Object.entries(input.metrics)
        .filter(([, v]) => v !== undefined && v !== null)
        .map(([k, v]) => `${k}=${v}`)
        .join(", ")
    : "(none)";

  const prompt = `[[winner_diagnosis]]
Diagnose why this post won and generate a variant plan.

Winning post:
  Hook: ${input.hook}
  Format: ${input.format ?? "(unknown)"}
  Angle: ${input.angle ?? "(unknown)"}
  Audience: ${input.audience ?? "(unknown)"}
  CTA: ${input.cta ?? "(unknown)"}

Metrics: ${metricsLine}
Founder notes: ${input.notes ?? "(none)"}

Return:
- winning_reason: 2-3 sentences explaining WHY this won
- winning_elements: structured (hook, format, angle, audience, cta, visual_style)
- recommended_next_actions: 3-6 concrete actions
- variant_plan: 10 distinct variant ideas (each with hook + angle)
- learning_to_store: 1-2 sentence durable lesson to write to project memory`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: WinnerDiagnosisSchema,
    schemaName: "WinnerDiagnosis",
    temperature: 0.6,
  });

  return {
    diagnosis: result.object,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}

export interface VariantsInput {
  winningHook: string;
  format?: string;
  angle?: string;
  audience?: string;
  niche?: string;
  count?: number;
}

export async function generateVariants(input: VariantsInput): Promise<{
  variants: Variants["variants"];
  raw: string;
  provider: string;
  model: string;
  latencyMs: number;
}> {
  const prompt = `[[variants]]
Generate ${input.count ?? 10} distinct variants of this winner.

Winner:
  Hook: ${input.winningHook}
  Format: ${input.format ?? ""}
  Angle: ${input.angle ?? ""}
  Audience: ${input.audience ?? ""}
  Niche: ${input.niche ?? ""}

Rules:
- Each variant must shift one major lever: angle, audience, format, or framing.
- Don't paraphrase the winning hook — give it a different bone structure.
- Keep hooks under 14 words.`;

  const result = await generateObject({
    system: SYSTEM,
    prompt,
    schema: VariantsSchema,
    schemaName: "Variants",
    temperature: 0.8,
  });

  return {
    variants: result.object.variants,
    raw: result.raw,
    provider: result.provider,
    model: result.model,
    latencyMs: result.latencyMs,
  };
}
