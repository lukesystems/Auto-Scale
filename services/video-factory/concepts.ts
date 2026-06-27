import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { logAIRun } from "@/services/ai/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadProductBrief,
  loadVideoPatterns,
} from "@/services/growth-run/repository";
import { resolveProductionMode } from "./production-modes";
import {
  WinningFormatPlanSchema,
  type FormatHypothesis,
} from "@/services/winning-format/schema";
import type {
  GrowthRunOptions,
  PostingLoadout,
  VideoStrategy,
  VideoTrendReport,
} from "@/services/growth-run/schema";

/**
 * Build one controlled Winning Format experiment per format hypothesis.
 *
 * Each experiment holds audience, body, CTA, format, platform, and duration
 * constant while changing exactly three hooks. This replaces the old batch of
 * unrelated concepts and gives Compound a causal unit it can scale or kill.
 */
export async function generateVideoConcepts(opts: {
  projectId: string;
  growthRunId: string;
  ownerId: string;
  trendReport: VideoTrendReport;
  strategy: VideoStrategy;
  loadout: PostingLoadout;
  options: GrowthRunOptions;
}): Promise<{ conceptIds: string[]; formatFingerprintIds: string[] }> {
  const supabase = createSupabaseServerClient();
  const [brief, patterns, reportRow, growthRun] = await Promise.all([
    loadProductBrief(opts.projectId),
    loadVideoPatterns(opts.projectId),
    supabase
      .from("video_trend_reports")
      .select("evidence_video_ids")
      .eq("growth_run_id", opts.growthRunId)
      .maybeSingle(),
    supabase.from("growth_runs").select("batch_kind").eq("id", opts.growthRunId).single(),
  ]);

  const batchKind = growthRun.data?.batch_kind ?? "exploration";
  let winnerSeeds: Array<{ hook: string; platform: string; cta: string | null; video_type: string }> = [];

  if (batchKind === "exploitation") {
    const { data: winnerRows } = await supabase
      .from("growth_experiment_results")
      .select("video_id, classification, metric_summary")
      .eq("project_id", opts.projectId)
      .eq("classification", "winner")
      .order("created_at", { ascending: false })
      .limit(8);

    const videoIds = (winnerRows ?? []).map((r) => r.video_id);
    if (videoIds.length) {
      const { data: winnerVideos } = await supabase
        .from("videos")
        .select("id, concept_id")
        .in("id", videoIds);
      const conceptIds = (winnerVideos ?? []).map((v) => v.concept_id).filter(Boolean) as string[];
      if (conceptIds.length) {
        const { data: concepts } = await supabase
          .from("video_concepts")
          .select("hook, platform, cta, video_type")
          .in("id", conceptIds);
        winnerSeeds = concepts ?? [];
      }
    }
  }

  // Adopt TrendHop / queued concepts for this run.
  const { data: queued } = await supabase
    .from("video_concepts")
    .select("id")
    .eq("project_id", opts.projectId)
    .eq("queued_for_next_run", true)
    .is("growth_run_id", null);
  if (queued?.length) {
    await supabase
      .from("video_concepts")
      .update({ growth_run_id: opts.growthRunId, queued_for_next_run: false })
      .in(
        "id",
        queued.map((q) => q.id)
      );
  }

  const availableEvidenceIds = asStringArray(reportRow.data?.evidence_video_ids);
  const availablePatternIds = patterns.slice(0, 30).map((pattern) => pattern.id);
  const allowedEvidence = new Set(availableEvidenceIds);
  const allowedPatterns = new Set(availablePatternIds);
  const formatCount = opts.options.concept_target_count >= 6 ? 2 : 1;
  const brandCta =
    (opts.options.brand_constraints?.primary_cta_label as string | undefined) ??
    brief?.cta ??
    "Start free";

  const platformPriority = Object.entries(opts.strategy.platform_mix)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([platform]) => platform);
  const typePriority = Object.entries(opts.strategy.video_type_mix)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([videoType]) => videoType);

  const prompt = [
    "You are AutoScale's Winning Format Lab planner.",
    `Return exactly ${formatCount} format hypothesis${formatCount === 1 ? "" : "es"}.`,
    "For each format, return exactly 3 hook variants.",
    "Within each format experiment, hold the audience, body, CTA, platform, format, and duration constant.",
    "Change only the hook mechanism and opening wording across the 3 variants.",
    "Do not generate unrelated video ideas. This is a controlled experiment.",
    "Separate observed evidence from strategic inference. Never invent metrics or source IDs.",
    "Use only evidence_video_ids and source_pattern_ids provided below. Leave arrays empty when support is missing.",
    "Prefer SaaS-native formats: demo, pain-led slide, founder POV, objection, or comparison.",
    "AI b-roll is allowed only when it strengthens the message.",
    `Hold CTA constant across variants: "${brandCta}".`,
    "",
    "Product brief:",
    JSON.stringify({
      product: brief?.product_name ?? brief?.one_line_description ?? null,
      target_customer: brief?.target_customer ?? null,
      primary_pain: brief?.primary_pain ?? null,
      core_promise: brief?.core_promise ?? null,
      cta: brief?.cta ?? null,
      offer: brief?.offer ?? null,
    }),
    "",
    "VideoTrend evidence:",
    JSON.stringify({
      winning_structures: opts.trendReport.winning_structures.slice(0, 6),
      hook_patterns: opts.trendReport.hook_patterns.slice(0, 10),
      cta_patterns: opts.trendReport.cta_patterns.slice(0, 6),
      recommended_experiments: opts.trendReport.recommended_experiments.slice(0, 8),
      audience_language: opts.trendReport.audience_language.slice(0, 10),
      confidence: opts.trendReport.confidence,
      available_evidence_video_ids: availableEvidenceIds,
      available_source_patterns: patterns.slice(0, 30).map((pattern) => ({
        id: pattern.id,
        type: pattern.pattern_type,
        label: pattern.label,
        description: pattern.description,
        confidence: pattern.confidence,
      })),
    }),
    "",
    "Strategy priority:",
    JSON.stringify({ platformPriority, typePriority }),
    batchKind === "exploitation" && winnerSeeds.length
      ? [
          "",
          "EXPLOITATION BATCH — seed from proven winners first:",
          JSON.stringify(winnerSeeds),
          "At least one format must remix a winning hook/format/CTA from the list above.",
        ].join("\n")
      : "",
    "",
    "The plan must include one audience pain, fixed body, fixed CTA, fixed audience, a 3-7 day evaluation window,",
    "and 1-2 format fingerprints with transferability, distortion risk, confidence, missing evidence, and three variants.",
    "Use lowercase enum values exactly as shown. Every format and variant must include every key in this example:",
    JSON.stringify({
      audience_pain: "Roblox creators lose hours turning UI ideas into production-ready HUDs.",
      fixed_body: "Show the manual workflow, then show the same workflow completed with the product.",
      fixed_cta: "Join the waitlist.",
      fixed_audience: "Roblox creators shipping polished game interfaces.",
      tested_variable: "hook",
      evaluation_window_days: 3,
      formats: [
        {
          format_name: "Pain to product demo",
          video_type: "demo",
          platform: "youtube",
          target_length_seconds: 24,
          hook_mechanism: "Call out wasted production time.",
          visual_grammar: "Problem screen, rapid product demo, finished HUD reveal, CTA end card.",
          script_structure: ["pain", "manual workflow", "product shortcut", "result", "cta"],
          cta_pattern: "Invite qualified creators to join the waitlist.",
          business_hypothesis: "A concrete workflow demonstration will drive qualified product clicks.",
          transferability_score: 0.7,
          distortion_risk: "low",
          confidence: 0.6,
          missing_evidence: ["No linked source video performance metrics."],
          evidence_video_ids: [],
          source_pattern_ids: [],
          observed_evidence: ["The supplied trend report recommends product demonstrations."],
          strategic_inference: ["Showing the workflow should make the product promise tangible."],
          variants: [
            { variant_label: "A", hook: "Still building every Roblox HUD from scratch?", angle: "Time cost", promise: "Move from idea to a production-ready direction faster.", hypothesis: "A time-loss hook will attract creators with urgent production pain.", expected_signal: "Qualified product link clicks." },
            { variant_label: "B", hook: "Your Roblox UI should not take an entire sprint.", angle: "Sprint delay", promise: "Shorten the path from concept to Studio handoff.", hypothesis: "A delivery-speed hook will attract small teams.", expected_signal: "Qualified product link clicks." },
            { variant_label: "C", hook: "The slowest part of your Roblox game might be the HUD.", angle: "Workflow bottleneck", promise: "Turn a UI direction into usable production guidance quickly.", hypothesis: "A bottleneck hook will earn higher intent engagement.", expected_signal: "Qualified product link clicks." },
          ],
        },
      ],
    }),
    `Return exactly ${formatCount} item${formatCount === 1 ? "" : "s"} in formats; when two are required, repeat the full format object shape with a different controlled format hypothesis.`,
  ].join("\n");

  const response = await generateObject({
    schema: WinningFormatPlanSchema,
    schemaDescription:
      "WinningFormatPlan JSON. Top-level: audience_pain, fixed_body, fixed_cta, fixed_audience, tested_variable ('hook'), evaluation_window_days, formats. Every format requires format_name, lowercase video_type, lowercase platform, target_length_seconds, hook_mechanism, visual_grammar, script_structure, cta_pattern, business_hypothesis, transferability_score, lowercase distortion_risk, confidence, missing_evidence, evidence_video_ids, source_pattern_ids, observed_evidence, strategic_inference, and exactly 3 variants. Every variant requires variant_label, hook, angle, promise, hypothesis, expected_signal.",
    taskType: "content",
    system:
      "You design controlled short-form video experiments. You optimize for causal learning and business signals, not output volume.",
    prompt,
    temperature: 0.4,
    maxTokens: 7000,
  });

  await logAIRun({
    ownerId: opts.ownerId,
    projectId: opts.projectId,
    kind: "winning_format.plan",
    provider: response.provider,
    model: response.model,
    status: "success",
    latencyMs: response.latencyMs,
    retryCount: response.retries,
    input: { formatCount, variantsPerFormat: 3 },
    parsedOutput: {
      formats: response.object.formats.map((format) => ({
        name: format.format_name,
        videoType: format.video_type,
        platform: format.platform,
      })),
    },
  });

  const conceptIds: string[] = [];
  const formatFingerprintIds: string[] = [];

  for (const format of response.object.formats) {
    const normalized = normalizeEvidence(format, allowedEvidence, allowedPatterns);
    const fingerprintKey = createFingerprintKey(normalized);
    const { data: fingerprint, error: fingerprintError } = await supabase
      .from("format_fingerprints")
      .insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        name: normalized.format_name,
        fingerprint_key: fingerprintKey,
        video_type: normalized.video_type,
        platform: normalized.platform,
        hook_mechanism: normalized.hook_mechanism,
        visual_grammar: normalized.visual_grammar,
        script_structure: normalized.script_structure as never,
        cta_pattern: normalized.cta_pattern,
        business_hypothesis: normalized.business_hypothesis,
        transferability_score: normalized.transferability_score,
        distortion_risk: normalized.distortion_risk,
        confidence: normalized.confidence,
        missing_evidence: normalized.missing_evidence as never,
        evidence_video_ids: normalized.evidence_video_ids as never,
        source_pattern_ids: normalized.source_pattern_ids as never,
        status: "testing",
      })
      .select("id")
      .single();
    if (fingerprintError || !fingerprint) {
      throw new Error(`format_fingerprints insert: ${fingerprintError?.message ?? "unknown"}`);
    }
    formatFingerprintIds.push(fingerprint.id);

    const startsAt = new Date();
    const endsAt = new Date(startsAt.getTime() + response.object.evaluation_window_days * 86_400_000);
    const { data: experiment, error: experimentError } = await supabase
      .from("controlled_experiments")
      .insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        format_fingerprint_id: fingerprint.id,
        tested_variable: "hook",
        audience_pain: response.object.audience_pain,
        fixed_body: response.object.fixed_body,
        fixed_cta: response.object.fixed_cta,
        fixed_audience: response.object.fixed_audience,
        evaluation_window_days: response.object.evaluation_window_days,
        status: "running",
        starts_at: startsAt.toISOString(),
        ends_at: endsAt.toISOString(),
      })
      .select("id")
      .single();
    if (experimentError || !experiment) {
      throw new Error(`controlled_experiments insert: ${experimentError?.message ?? "unknown"}`);
    }

    for (const variant of normalized.variants) {
      const productionMode = resolveProductionMode(normalized.video_type);
      const { data: concept, error: conceptError } = await supabase
        .from("video_concepts")
        .insert({
          growth_run_id: opts.growthRunId,
          project_id: opts.projectId,
          video_type: normalized.video_type,
          production_mode: productionMode,
          platform: normalized.platform,
          target_length_seconds: normalized.target_length_seconds,
          hook: variant.hook,
          angle: variant.angle,
          promise: variant.promise,
          cta: response.object.fixed_cta,
          hypothesis: variant.hypothesis,
          source_pattern_id: normalized.source_pattern_ids[0] ?? null,
          evidence_video_ids: normalized.evidence_video_ids as never,
          status: "draft",
        } as never)
        .select("id")
        .single();
      if (conceptError || !concept) {
        throw new Error(`video_concepts insert: ${conceptError?.message ?? "unknown"}`);
      }
      conceptIds.push(concept.id);

      const { error: cellError } = await supabase.from("experiment_cells").insert({
        project_id: opts.projectId,
        experiment_id: experiment.id,
        concept_id: concept.id,
        variant_label: variant.variant_label,
        variable_value: variant.hook,
        hypothesis: variant.hypothesis,
      });
      if (cellError) throw new Error(`experiment_cells insert: ${cellError.message}`);

      const missingEvidence = [...normalized.missing_evidence];
      if (!normalized.evidence_video_ids.length && !normalized.source_pattern_ids.length) {
        missingEvidence.push("No source video or mined pattern was linked to this format.");
      }
      const hasEvidence =
        normalized.evidence_video_ids.length > 0 || normalized.source_pattern_ids.length > 0;
      const receiptConfidence = hasEvidence
        ? normalized.confidence
        : Math.min(normalized.confidence, 0.35);
      const whyThisExists = [
        "Why this exists:",
        `Observed evidence: ${normalized.observed_evidence.join(" | ")}`,
        `Source pattern: ${normalized.source_pattern_ids.length ? normalized.source_pattern_ids.join(", ") : "none linked"}`,
        `Strategic inference: ${normalized.strategic_inference.join(" | ")}`,
        `Expected signal: ${variant.expected_signal}`,
        `Confidence: ${receiptConfidence.toFixed(2)}`,
        hasEvidence
          ? "Missing evidence: none critical"
          : `Missing evidence: ${missingEvidence.join("; ")}`,
      ].join("\n");

      const { error: receiptError } = await supabase.from("trend_receipts").insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        concept_id: concept.id,
        format_fingerprint_id: fingerprint.id,
        evidence_video_ids: normalized.evidence_video_ids as never,
        source_pattern_ids: normalized.source_pattern_ids as never,
        observed_evidence: normalized.observed_evidence as never,
        strategic_inference: [...normalized.strategic_inference, variant.hypothesis] as never,
        expected_signal: variant.expected_signal,
        reasoning: `${whyThisExists}\n\n${normalized.business_hypothesis}`,
        confidence: receiptConfidence,
        missing_evidence: missingEvidence as never,
      });
      if (receiptError) throw new Error(`trend_receipts insert: ${receiptError.message}`);
    }
  }

  return { conceptIds, formatFingerprintIds };
}

function normalizeEvidence(
  format: FormatHypothesis,
  allowedEvidence: Set<string>,
  allowedPatterns: Set<string>
): FormatHypothesis {
  return {
    ...format,
    evidence_video_ids: format.evidence_video_ids.filter((id) => allowedEvidence.has(id)),
    source_pattern_ids: format.source_pattern_ids.filter((id) => allowedPatterns.has(id)),
  };
}

export function createFingerprintKey(format: Pick<FormatHypothesis, "video_type" | "platform" | "format_name">) {
  const name = format.format_name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 64);
  return `${format.video_type}:${format.platform}:${name || "format"}`;
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}
