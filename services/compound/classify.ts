import "server-only";

import { createSupabaseAdminClient, createSupabaseServerClient } from "@/lib/supabase/server";
import { generateObject } from "@/services/ai/runtime";
import {
  ExperimentClassificationSchema,
  type ExperimentClassification,
} from "@/services/growth-run/schema";
import { materializeWinnerVariants } from "@/services/compound/materialize-winner";

/**
 * Compound v2.
 *
 * For each posted video in a Growth Run, aggregate owned-side events
 * (link clicks, pixel signups, payments) + manual metrics into a metric
 * summary, ask the model to classify the experiment, then write a
 * growth_experiment_results row. For winners, spawn winner_variants and
 * a new child Growth Run; for repeated losers, write a kill_decision and
 * a learning_memory row so the next run weights formats accordingly.
 *
 * This is the retention engine. The doc said it plainly: if AutoScale
 * does not improve from results, users churn.
 */

export interface RunCompoundOpts {
  growthRunId: string;
  projectId: string;
  ownerId: string;
  trustedServiceRole?: boolean;
  /** Videos with watch_time below this completion rate count as weak watch */
  weakCompletionThreshold?: number;
  /** Click-through rate below this counts as weak CTA */
  weakClickRateThreshold?: number;
  /** Signups required to count as winner */
  winnerSignupThreshold?: number;
}

export interface CompoundResultSummary {
  classifiedCount: number;
  winners: number;
  losers: number;
  variantsQueued: number;
  killDecisions: number;
}

export async function runCompound(opts: RunCompoundOpts): Promise<CompoundResultSummary> {
  const supabase = opts.trustedServiceRole
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();

  const { data: videos } = await supabase
    .from("videos")
    .select("id, concept_id, growth_run_id, project_id, status")
    .eq("growth_run_id", opts.growthRunId)
    .in("status", ["posted", "ready", "approved"]);

  if (!videos?.length) {
    return { classifiedCount: 0, winners: 0, losers: 0, variantsQueued: 0, killDecisions: 0 };
  }

  let winners = 0;
  let losers = 0;
  let variantsQueued = 0;
  let killDecisions = 0;
  let classified = 0;

  for (const video of videos) {
    const { data: existingResult } = await supabase
      .from("growth_experiment_results")
      .select("id, classification")
      .eq("video_id", video.id)
      .maybeSingle();
    if (existingResult) {
      if (existingResult.classification === "winner") {
        const materialized = await materializeWinnerVariants({
          client: supabase,
          projectId: opts.projectId,
          ownerId: opts.ownerId,
          sourceGrowthRunId: opts.growthRunId,
          sourceVideoId: video.id,
          experimentResultId: existingResult.id,
          trustedServiceRole: opts.trustedServiceRole,
        });
        if (!materialized.reusedExisting) {
          variantsQueued += materialized.conceptIds.length;
        }
      }
      continue;
    }

    const summary = await aggregateMetrics(supabase, video.id, opts.projectId);
    if (!summary.hasSignal) continue;

    const { data: receipt } = await supabase
      .from("trend_receipts")
      .select("format_fingerprint_id")
      .eq("concept_id", video.concept_id)
      .maybeSingle();
    const { data: experimentCell } = await supabase
      .from("experiment_cells")
      .select("experiment_id")
      .eq("concept_id", video.concept_id)
      .maybeSingle();

    const classification = await classifyOne({
      video,
      summary,
      thresholds: {
        weakCompletion: opts.weakCompletionThreshold ?? 0.35,
        weakClick: opts.weakClickRateThreshold ?? 0.005,
        winnerSignups: opts.winnerSignupThreshold ?? 3,
      },
    });

    const { data: resultRow, error } = await supabase
      .from("growth_experiment_results")
      .insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        video_id: video.id,
        classification: classification.classification,
        diagnosis: classification.diagnosis,
        next_action: classification.next_action,
        confidence: classification.confidence,
        metric_summary: summary as never,
        controlled_experiment_id: experimentCell?.experiment_id ?? null,
        format_fingerprint_id: receipt?.format_fingerprint_id ?? null,
      })
      .select("id")
      .single();
    if (error) continue;
    classified++;

    if (classification.classification === "winner") {
      winners++;
      const materialized = await materializeWinnerVariants({
        client: supabase,
        projectId: opts.projectId,
        ownerId: opts.ownerId,
        sourceGrowthRunId: opts.growthRunId,
        sourceVideoId: video.id,
        experimentResultId: resultRow!.id,
        trustedServiceRole: opts.trustedServiceRole,
      });
      if (!materialized.reusedExisting) {
        variantsQueued += materialized.conceptIds.length;
      }
    }
    if (
      classification.classification === "loser" ||
      classification.next_action === "kill"
    ) {
      losers++;
      await supabase.from("kill_decisions").insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        video_id: video.id,
        scope: "video",
        reason: classification.diagnosis,
        metric_evidence: summary as never,
      });
      await supabase.from("videos").update({ status: "killed" }).eq("id", video.id);
      killDecisions++;
    }

    await updateLearningMemory(supabase, {
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      videoId: video.id,
      classification,
      summary,
    });
    await updateFormatDecision(supabase, {
      formatFingerprintId: receipt?.format_fingerprint_id ?? null,
      controlledExperimentId: experimentCell?.experiment_id ?? null,
      classification,
    });
  }

  return {
    classifiedCount: classified,
    winners,
    losers,
    variantsQueued,
    killDecisions,
  };
}

interface MetricSummary {
  hasSignal: boolean;
  views: number;
  completionRate: number | null;
  link_clicks: number;
  pixel_signups: number;
  signups: number;
  paid_users: number;
  revenue_cents: number;
  click_through_rate: number | null;
  signup_rate: number | null;
}

async function aggregateMetrics(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  videoId: string,
  projectId: string
): Promise<MetricSummary> {
  const { data: metricRows } = await supabase
    .from("video_run_metrics")
    .select("*")
    .eq("video_id", videoId)
    .order("captured_at", { ascending: false })
    .limit(1);
  const latest = metricRows?.[0];

  const { data: linkRows } = await supabase
    .from("tracked_links")
    .select("id, click_count")
    .eq("video_id", videoId)
    .eq("project_id", projectId);
  const totalClicks = (linkRows ?? []).reduce((s, r) => s + (r.click_count ?? 0), 0);

  const { count: signupCount } = await supabase
    .from("signup_events")
    .select("id", { count: "exact", head: true })
    .eq("video_id", videoId);

  const { data: payments } = await supabase
    .from("payment_events")
    .select("amount_cents")
    .eq("video_id", videoId);
  const paidUsers = payments?.length ?? 0;
  const revenue = (payments ?? []).reduce((s, p) => s + (p.amount_cents ?? 0), 0);

  const views = latest?.views ?? 0;
  const manualSignups = latest?.signups ?? 0;
  const ownedSignups = signupCount ?? 0;
  const allSignups = Math.max(manualSignups, ownedSignups);

  return {
    hasSignal: views > 0 || totalClicks > 0 || allSignups > 0,
    views,
    completionRate: latest?.completion_rate ?? null,
    link_clicks: Math.max(latest?.link_clicks ?? 0, totalClicks),
    pixel_signups: ownedSignups,
    signups: allSignups,
    paid_users: paidUsers,
    revenue_cents: revenue,
    click_through_rate: views > 0 ? Math.max(latest?.link_clicks ?? 0, totalClicks) / views : null,
    signup_rate:
      Math.max(latest?.link_clicks ?? 0, totalClicks) > 0
        ? allSignups / Math.max(latest?.link_clicks ?? 0, totalClicks)
        : null,
  };
}

async function classifyOne(input: {
  video: { id: string; concept_id: string };
  summary: MetricSummary;
  thresholds: { weakCompletion: number; weakClick: number; winnerSignups: number };
}): Promise<ExperimentClassification> {
  // First, deterministic rules — only fall back to model when rules are mute.
  const { summary, thresholds } = input;
  if (summary.signups >= thresholds.winnerSignups || summary.paid_users >= 1) {
    return {
      classification: "winner",
      diagnosis: `Generated ${summary.signups} signups${summary.paid_users ? ` and ${summary.paid_users} paid users` : ""} from ${summary.views || "unknown"} views. Compound.`,
      next_action: "variant",
      confidence: 0.85,
    };
  }
  if (
    summary.views > 1500 &&
    summary.completionRate !== null &&
    summary.completionRate < thresholds.weakCompletion
  ) {
    return {
      classification: "weak_hook",
      diagnosis: `High views (${summary.views}) but completion rate ${(summary.completionRate * 100).toFixed(0)}% — hook is not earning the watch.`,
      next_action: "rewrite_hook",
      confidence: 0.75,
    };
  }
  if (
    summary.views > 1500 &&
    summary.click_through_rate !== null &&
    summary.click_through_rate < thresholds.weakClick
  ) {
    return {
      classification: "weak_cta",
      diagnosis: `Strong reach (${summary.views} views) but only ${summary.link_clicks} clicks — CTA is weak.`,
      next_action: "rewrite_cta",
      confidence: 0.75,
    };
  }
  if (summary.views > 5000 && summary.signups === 0 && summary.link_clicks < 5) {
    return {
      classification: "loser",
      diagnosis: `${summary.views} views, ${summary.link_clicks} clicks, 0 signups. Audience may not be a fit.`,
      next_action: "kill",
      confidence: 0.7,
    };
  }
  if (summary.views < 300 && summary.link_clicks === 0) {
    return {
      classification: "inconclusive",
      diagnosis: "Not enough reach yet to learn from this video.",
      next_action: "review",
      confidence: 0.6,
    };
  }

  // Fall through to model for nuanced cases.
  const res = await generateObject({
    schema: ExperimentClassificationSchema,
    schemaDescription:
      "ExperimentClassification: classification, diagnosis, next_action, confidence.",
    taskType: "compound",
    system:
      "You diagnose short-form video experiments. Be conservative. Use the metric summary; do not speculate beyond it.",
    prompt: [
      "Metric summary:",
      JSON.stringify(summary),
      "Classify the experiment and recommend the next action.",
    ].join("\n"),
    temperature: 0.2,
  });
  return res.object;
}

async function updateLearningMemory(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  opts: {
  projectId: string;
  growthRunId: string;
  videoId: string;
  classification: ExperimentClassification;
  summary: MetricSummary;
}) {
  const { data: video } = await supabase
    .from("videos")
    .select("concept_id")
    .eq("id", opts.videoId)
    .single();
  if (!video?.concept_id) return;
  const { data: concept } = await supabase
    .from("video_concepts")
    .select("video_type, platform, hook")
    .eq("id", video.concept_id)
    .single();
  if (!concept) return;

  const formatKey = `${concept.video_type}:${concept.platform}`;
  const weightDelta =
    opts.classification.classification === "winner"
      ? 0.25
      : opts.classification.classification === "loser"
        ? -0.25
        : 0;

  // Upsert format performance learning row.
  const { data: existing } = await supabase
    .from("learning_memory")
    .select("id, weight, evidence_count, value")
    .eq("project_id", opts.projectId)
    .eq("kind", "format_performance")
    .eq("key", formatKey)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("learning_memory")
      .update({
        weight: Math.max(-2, Math.min(2, existing.weight + weightDelta)),
        evidence_count: existing.evidence_count + 1,
        last_seen_at: new Date().toISOString(),
        value: {
          ...(existing.value as Record<string, unknown>),
          last_summary: opts.summary,
        } as never,
      })
      .eq("id", existing.id);
  } else {
    await supabase.from("learning_memory").insert({
      project_id: opts.projectId,
      growth_run_id: opts.growthRunId,
      kind: "format_performance",
      key: formatKey,
      weight: weightDelta,
      evidence_count: 1,
      value: { last_summary: opts.summary } as never,
    });
  }
}

async function updateFormatDecision(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  opts: {
    formatFingerprintId: string | null;
    controlledExperimentId: string | null;
    classification: ExperimentClassification;
  }
) {
  const compoundAction =
    opts.classification.classification === "winner"
      ? "scale"
      : opts.classification.classification === "loser" || opts.classification.next_action === "kill"
        ? "kill"
        : ["weak_hook", "weak_cta", "message_mismatch"].includes(opts.classification.classification)
          ? "iterate"
          : opts.classification.classification === "inconclusive"
            ? "inconclusive"
            : null;

  const fingerprintStatus =
    compoundAction === "scale"
      ? "winner"
      : compoundAction === "kill"
        ? "killed"
        : compoundAction === "iterate"
          ? "iterate"
          : null;
  const experimentStatus =
    compoundAction === "scale"
      ? "scale"
      : compoundAction === "kill"
        ? "kill"
        : compoundAction === "iterate"
          ? "iterate"
          : compoundAction === "inconclusive"
            ? "evaluating"
            : null;

  const pausedUntil =
    compoundAction === "kill"
      ? new Date(Date.now() + 14 * 24 * 60 * 60 * 1000).toISOString()
      : null;

  if (opts.formatFingerprintId && (fingerprintStatus || compoundAction)) {
    await supabase
      .from("format_fingerprints")
      .update({
        status: fingerprintStatus ?? undefined,
        compound_action: compoundAction,
        paused_until: pausedUntil,
      } as never)
      .eq("id", opts.formatFingerprintId);
  }
  if (opts.controlledExperimentId && experimentStatus) {
    await supabase
      .from("controlled_experiments")
      .update({ status: experimentStatus })
      .eq("id", opts.controlledExperimentId);
  }
}
