import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { logAIRun } from "@/services/ai/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadConnectedAccounts,
  loadKillDecisions,
  loadLearningMemory,
  loadProductBrief,
} from "@/services/growth-run/repository";
import {
  PostingLoadoutSchema,
  VideoStrategySchema,
  type PostingLoadout,
  type VideoStrategy,
  type VideoTrendReport,
  type GrowthRunOptions,
} from "@/services/growth-run/schema";

/**
 * Video Strategy Agent.
 *
 * Reads ProductBrief + VideoTrendReport + user options (target platforms,
 * connected accounts, aggressiveness) and outputs:
 *   - VideoStrategy: platform mix %, video-type mix %, campaign hypotheses
 *   - PostingLoadout: per-account daily cadence over duration_days
 *
 * Per the direction: "AutoScale should decide the video mix" + "different
 * platform/account combinations" + account-health rules.
 */

const AGGRESSIVENESS_VIDEOS_PER_ACCOUNT_PER_DAY: Record<
  GrowthRunOptions["posting_aggressiveness"],
  number
> = {
  conservative: 1,
  balanced: 2,
  aggressive: 4,
};

export async function generateVideoStrategy(opts: {
  projectId: string;
  growthRunId: string;
  ownerId: string;
  trendReport: VideoTrendReport;
  options: GrowthRunOptions;
}): Promise<{
  strategy: VideoStrategy;
  loadout: PostingLoadout;
  strategyId: string;
  loadoutId: string;
}> {
  const [brief, accounts, learningMemory, killDecisions] = await Promise.all([
    loadProductBrief(opts.projectId),
    loadConnectedAccounts(
      opts.projectId,
      opts.options.connected_account_ids.length ? opts.options.connected_account_ids : undefined
    ),
    loadLearningMemory(opts.projectId),
    loadKillDecisions(opts.projectId),
  ]);

  const briefPacket = brief
    ? {
        product: brief.product_name ?? brief.one_line_description ?? null,
        target_customer: brief.target_customer ?? null,
        primary_pain: brief.primary_pain ?? null,
        core_promise: brief.core_promise ?? null,
        cta: brief.cta ?? null,
        offer: brief.offer ?? null,
      }
    : null;

  const productionConstraints = brief?.production_constraints as
    | { can_make_carousels?: boolean }
    | null
    | undefined;
  const canMakeCarousels = productionConstraints?.can_make_carousels !== false;

  const accountPacket = accounts.map((a) => ({
    id: a.id,
    platform: a.platform,
    handle: a.handle,
    persona: a.persona ?? null,
    max_per_day: a.max_posts_per_day,
  }));

  const prompt = [
    "You are AutoScale's Video Strategy Agent.",
    "Pick the right short-form video mix for this SaaS founder.",
    "",
    "Product brief:",
    JSON.stringify(briefPacket),
    "",
    "VideoTrend report (the niche evidence):",
    JSON.stringify({
      winning_structures: opts.trendReport.winning_structures,
      hook_patterns: opts.trendReport.hook_patterns,
      cta_patterns: opts.trendReport.cta_patterns,
      platform_patterns: opts.trendReport.platform_patterns,
      recommended_experiments: opts.trendReport.recommended_experiments,
      competitor_gaps: opts.trendReport.competitor_gaps,
    }),
    "",
    "Prior project learning (must influence this run):",
    JSON.stringify({
      weighted_memory: learningMemory.map((memory) => ({
        kind: memory.kind,
        key: memory.key,
        weight: memory.weight,
        evidence_count: memory.evidence_count,
        value: memory.value,
      })),
      recent_kill_decisions: killDecisions,
    }),
    "Use positive, repeated learning to increase a format's share.",
    "Suppress killed or negative-weight formats unless new evidence explicitly justifies a retest.",
    "Do not treat a single weak signal as proof.",
    "",
    "User options:",
    JSON.stringify({
      target_platforms: opts.options.target_platforms,
      aggressiveness: opts.options.posting_aggressiveness,
      duration_days: opts.options.duration_days,
      connected_accounts: accountPacket,
      concept_target_count: opts.options.concept_target_count,
    }),
    "",
    "Return a strict JSON object matching VideoStrategy:",
    "- platform_mix: weights summing to 1.0 across the target platforms only.",
    "- video_type_mix: weights summing to 1.0 across video types (slide / demo / founder_pov / pain_led / trend_remix / ai_broll / objection / comparison / carousel). Prefer slide + demo for SaaS unless evidence says otherwise.",
    canMakeCarousels
      ? "- carousel is allowed when brief production_constraints.can_make_carousels is true — weight it on instagram when evidence supports swipeable formats."
      : "- do not allocate weight to carousel — production_constraints.can_make_carousels is false.",
    "- campaign_hypotheses: 3-6 testable hypotheses tied to the trend evidence.",
    "  Every hypothesis object MUST include hypothesis and metric_to_watch strings.",
    "- rationale: 3-5 sentences explaining the mix.",
    "Use this exact shape (replace the example values, never omit keys):",
    JSON.stringify({
      platform_mix: { tiktok: 0.4, instagram: 0.3, youtube: 0.3 },
      video_type_mix: { slide: 0.5, demo: 0.5 },
      campaign_hypotheses: [
        {
          hypothesis: "A pain-led demo will drive qualified product clicks.",
          metric_to_watch: "product_link_clicks",
          success_threshold: "At least 3 qualified clicks in the evaluation window.",
          kill_threshold: "No clicks after the evaluation window.",
        },
      ],
      rationale: "The mix prioritizes formats supported by the available evidence.",
    }),
  ].join("\n");

  const strategyRes = await generateObject({
    schema: VideoStrategySchema,
    schemaDescription:
      "VideoStrategy JSON with platform_mix and video_type_mix numeric records; campaign_hypotheses is an array of objects where every object contains hypothesis:string and metric_to_watch:string, plus optional success_threshold:string and kill_threshold:string; rationale:string.",
    taskType: "strategy_generation",
    system:
      "You are a growth strategist for SaaS short-form video. You output deterministic, founder-actionable mixes. Never recommend more volume than the connected accounts can support.",
    prompt,
    temperature: 0.3,
    maxTokens: 3000,
  });

  await logAIRun({
    ownerId: opts.ownerId,
    projectId: opts.projectId,
    kind: "video_strategy",
    provider: strategyRes.provider,
    model: strategyRes.model,
    status: "success",
    latencyMs: strategyRes.latencyMs,
    retryCount: strategyRes.retries,
    input: {
      aggressiveness: opts.options.posting_aggressiveness,
      learningRows: learningMemory.length,
      killDecisions: killDecisions.length,
    },
    parsedOutput: strategyRes.object,
  });

  const strategy = strategyRes.object;

  // Derive the loadout deterministically — we don't need an LLM for math.
  const perDay = AGGRESSIVENESS_VIDEOS_PER_ACCOUNT_PER_DAY[opts.options.posting_aggressiveness];
  const perAccountPlan = accounts.map((a) => ({
    connected_account_id: a.id,
    platform: a.platform,
    handle: a.handle,
    videos_per_day: Math.min(perDay, a.max_posts_per_day),
    video_type_focus: pickFocusForPlatform(a.platform, strategy),
  }));
  const totalPlanned = perAccountPlan.reduce(
    (sum, p) => sum + p.videos_per_day * opts.options.duration_days,
    0
  );

  const loadout = PostingLoadoutSchema.parse({
    per_account_plan: perAccountPlan,
    total_videos_planned: Math.max(totalPlanned, opts.options.concept_target_count),
    duration_days: opts.options.duration_days,
  });

  const supabase = createSupabaseServerClient();
  const { data: strategyRow, error: strategyError } = await supabase
    .from("video_strategies")
    .insert({
      growth_run_id: opts.growthRunId,
      project_id: opts.projectId,
      platform_mix: strategy.platform_mix as never,
      video_type_mix: strategy.video_type_mix as never,
      campaign_hypotheses: strategy.campaign_hypotheses as never,
      rationale: strategy.rationale,
    })
    .select("id")
    .single();
  if (strategyError) throw new Error(`video_strategies insert: ${strategyError.message}`);

  const { data: loadoutRow, error: loadoutError } = await supabase
    .from("posting_loadouts")
    .insert({
      growth_run_id: opts.growthRunId,
      project_id: opts.projectId,
      per_account_plan: loadout.per_account_plan as never,
      total_videos_planned: loadout.total_videos_planned,
      duration_days: loadout.duration_days,
      connected_account_ids: (opts.options.connected_account_ids ?? []) as never,
      distribution_mode: opts.options.distribution_mode ?? "postiz",
    } as never)
    .select("id")
    .single();
  if (loadoutError) throw new Error(`posting_loadouts insert: ${loadoutError.message}`);

  return {
    strategy,
    loadout,
    strategyId: strategyRow!.id,
    loadoutId: loadoutRow!.id,
  };
}

function pickFocusForPlatform(
  platform: "tiktok" | "instagram" | "youtube",
  strategy: VideoStrategy
): Array<keyof typeof strategy.video_type_mix> {
  const sorted = Object.entries(strategy.video_type_mix)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([k]) => k as keyof typeof strategy.video_type_mix);
  if (platform === "youtube") {
    // Shorts favor explanatory / demo
    return sorted.filter((t) => ["demo", "objection", "comparison", "slide"].includes(t)).slice(0, 3);
  }
  if (platform === "instagram") {
    return sorted.filter((t) => ["demo", "ai_broll", "founder_pov", "slide"].includes(t)).slice(0, 3);
  }
  return sorted.slice(0, 4);
}
