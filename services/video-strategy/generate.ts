import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { logAIRun } from "@/services/ai/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadConnectedAccounts,
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
  const brief = await loadProductBrief(opts.projectId);
  const accounts = await loadConnectedAccounts(
    opts.projectId,
    opts.options.connected_account_ids.length ? opts.options.connected_account_ids : undefined
  );

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
    "- video_type_mix: weights summing to 1.0 across video types (slide / demo / founder_pov / pain_led / trend_remix / ai_broll / objection / comparison). Prefer slide + demo for SaaS unless evidence says otherwise.",
    "- campaign_hypotheses: 3-6 testable hypotheses tied to the trend evidence.",
    "- rationale: 3-5 sentences explaining the mix.",
  ].join("\n");

  const strategyRes = await generateObject({
    schema: VideoStrategySchema,
    schemaDescription:
      "VideoStrategy: platform_mix (weights 0..1 by platform), video_type_mix (weights 0..1 by video_type), campaign_hypotheses[], rationale.",
    taskType: "content",
    system:
      "You are a growth strategist for SaaS short-form video. You output deterministic, founder-actionable mixes. Never recommend more volume than the connected accounts can support.",
    prompt,
    temperature: 0.3,
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
    input: { aggressiveness: opts.options.posting_aggressiveness },
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
    })
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
