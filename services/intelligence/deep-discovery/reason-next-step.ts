import { generateObject } from "@/services/ai/runtime";
import type { DiscoveryContext } from "../discovery/load-context";
import { formatDiscoveryContextForPrompt } from "../discovery/load-context";
import { buildFallbackDiscoveryPlan } from "../discovery/plan-discovery";
import { DeepDiscoveryActionSchema, type DeepDiscoveryAction } from "./schema";

const SYSTEM = `You are AutoScale's Competitor Intelligence Researcher running an iterative deep-research loop.

You do NOT plan everything up front. Each round you look at the evidence gathered so far and decide the single best next set of searches to deepen understanding of competitor distribution strategy.

Your job across rounds:
- Identify the founder's real direct and indirect competitors, plus audience magnets and creators in the niche.
- Find what is actually working for distribution (hooks, formats, angles, cadence, platforms) — from public evidence only.
- React to what you just found: chase promising leads, fill gaps, and confirm patterns across multiple accounts.

Rules:
- Output 2-6 focused next_queries per round (fewer as evidence saturates).
- Do NOT repeat queries already run. Build on what the evidence revealed (specific competitor names, handles, formats, communities surfaced so far).
- Prefer queries that confirm a pattern across multiple sources over chasing single viral posts.
- Mix platform-specific queries (site:x.com, site:reddit.com, site:youtube.com, site:linkedin.com, site:tiktok.com) with category, pain, alternative, and comparison queries.
- Never invent competitor names; only use names that appear in the brief, facts, or gathered evidence.
- Set should_continue=false when later rounds would yield diminishing returns or you have strong multi-source coverage.
- Record honest reasoning in "thought" and concrete working "hypotheses".
- Return JSON matching the schema.`;

export interface ReasonNextStepInput {
  context: DiscoveryContext;
  evidenceDigest: string;
  round: number;
  maxRounds: number;
  alreadyRunQueries: string[];
}

export interface ReasonNextStepResult {
  action: DeepDiscoveryAction;
  usedFallback: boolean;
  provider: string;
  model: string;
  latencyMs: number;
}

export async function reasonNextStep(input: ReasonNextStepInput): Promise<ReasonNextStepResult> {
  const ranList = input.alreadyRunQueries.length
    ? input.alreadyRunQueries.map((q) => `- ${q}`).join("\n")
    : "(none yet)";

  const prompt = `[[source_discovery]]
ROUND ${input.round} of up to ${input.maxRounds}.

PRODUCT CONTEXT:
${formatDiscoveryContextForPrompt(input.context)}

QUERIES ALREADY RUN (do not repeat):
${ranList}

EVIDENCE GATHERED SO FAR:
${input.evidenceDigest || "(no sources gathered yet — this is the opening round)"}

Decide the next searches. If this is round 1, cast a focused but broad net to find competitors and where the audience lives. In later rounds, drill into the strongest leads and confirm patterns across multiple accounts.`;

  try {
    const result = await generateObject({
      system: SYSTEM,
      prompt,
      schema: DeepDiscoveryActionSchema,
      schemaName: "DeepDiscoveryAction",
      taskType: "trendwatch",
      temperature: 0.5,
      maxTokens: 2500,
    });

    return {
      action: result.object,
      usedFallback: false,
      provider: result.provider,
      model: result.model,
      latencyMs: result.latencyMs,
    };
  } catch {
    return {
      action: buildFallbackAction(input),
      usedFallback: true,
      provider: "deterministic",
      model: "fallback",
      latencyMs: 0,
    };
  }
}

function buildFallbackAction(input: ReasonNextStepInput): DeepDiscoveryAction {
  // Round 1 falls back to the deterministic plan; later rounds stop, since a
  // non-AI fallback cannot meaningfully react to gathered evidence.
  if (input.round > 1) {
    return {
      thought: "AI reasoner unavailable; stopping the loop after the deterministic opening round.",
      hypotheses: [],
      next_queries: [],
      should_continue: false,
      stop_reason: "ai_unavailable",
    };
  }

  const plan = buildFallbackDiscoveryPlan(input.context);
  const seen = new Set(input.alreadyRunQueries.map((q) => q.toLowerCase()));
  const next = plan.queries
    .filter((q) => !seen.has(q.query.toLowerCase()))
    .slice(0, 6);

  return {
    thought: "Deterministic opening plan derived from the product brief (AI reasoner unavailable).",
    hypotheses: [],
    next_queries: next,
    should_continue: false,
    stop_reason: next.length ? null : "no_queries",
  };
}
