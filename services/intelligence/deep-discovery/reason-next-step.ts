import { generateObject } from "@/services/ai/runtime";
import type { DiscoveryContext } from "../discovery/load-context";
import { formatDiscoveryContextForPrompt } from "../discovery/load-context";
import { buildFallbackDiscoveryPlan } from "../discovery/plan-discovery";
import { DeepDiscoveryActionSchema, type DeepDiscoveryAction } from "./schema";

const SYSTEM = `You are AutoScale's Distribution Intelligence Researcher running an iterative deep-research loop.

Your job is NOT generic competitor research — it is to reverse-engineer what is already working for distribution in this niche so a SaaS founder can copy proven formats, not invent hooks from scratch.

Each round you look at evidence gathered so far and decide the best next searches to deepen understanding of:
- Direct and indirect competitors AND their unofficial/shadow/creator accounts (often outperform official pages)
- Where the target audience actually hangs out (Reddit, X, TikTok, YouTube, LinkedIn, review sites)
- What distribution patterns repeat (hooks, formats, angles, CTAs, cadence) — from public evidence only
- Comparison/review pages and "best alternatives" lists that reveal category winners

X (Twitter) is the priority platform: queries with platform_hint "x" are executed against a native X search API that returns REAL engagement metrics (likes, reposts, replies, views) — the highest-signal evidence available. Include 1-2 X queries in every early round. X queries must use plain topic/keyword phrasing (native X search), NOT site:x.com operators.

Query tactics (use explicitly when relevant):
- "${'{category}'}" OR "${'{pain}'}" founders — platform_hint "x" (what founders/creators say works in this niche)
- "${'{competitor}'}" alternative OR switched — platform_hint "x" (switching stories carry pain language + buying intent)
- "${'{competitor}'}" unofficial TikTok account OR shadow account
- "${'{competitor}'}" shadow account Instagram
- site:reddit.com "${'{pain}'}" tool recommendation
- "${'{category}'}" vs comparison 2025
- site:tiktok.com "${'{category}'}" ("10k followers" OR "100k followers")
- site:g2.com OR site:capterra.com "${'{category}'}"
- "${'{competitor}'}" affiliate creator OR partner account

Rules:
- Output 2-5 focused next_queries per round (fewer as evidence saturates).
- Set platform_hint on every query where a platform is implied ("x", "tiktok", "instagram", "reddit", "youtube", "linkedin"); leave null for open web searches.
- Do NOT repeat queries already run. Build on specific names, handles, formats, and communities surfaced in evidence.
- Prefer queries that confirm a pattern across multiple sources over chasing single viral posts.
- Use intents: shadow_account for unofficial/alt accounts; distribution for format/hook/cadence hunting; creator for individual creators; community for Reddit/Discord threads; comparison for G2/Capterra/vs pages.
- Never invent competitor names; only use names from the brief, facts, or gathered evidence.
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

Decide the next searches. Round 1: cast a focused net for competitors, shadow accounts, review/comparison pages, and where the audience discusses the pain. Later rounds: drill into strongest distribution leads and confirm patterns across multiple accounts.`;

  try {
    const result = await generateObject({
      system: SYSTEM,
      prompt,
      schema: DeepDiscoveryActionSchema,
      schemaName: "DeepDiscoveryAction",
      taskType: "discovery_reasoning",
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
    .slice(0, 8);

  return {
    thought: "Deterministic opening plan derived from the product brief (AI reasoner unavailable).",
    hypotheses: [],
    next_queries: next,
    should_continue: next.length >= 5,
    stop_reason: next.length ? null : "no_queries",
  };
}
