import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Json } from "@/lib/supabase/types";
import { generateObject } from "@/services/ai/runtime";
import { logAIRun } from "@/services/ai/logger";
import { buildVideosForRun } from "@/services/video-factory";
import { WinnerVariantBatchSchema } from "@/services/winning-format/schema";

type Client = SupabaseClient<Database>;

export async function materializeWinnerVariants(opts: {
  client: Client;
  projectId: string;
  ownerId: string;
  sourceGrowthRunId: string;
  sourceVideoId: string;
  experimentResultId: string;
  trustedServiceRole?: boolean;
}): Promise<{
  childGrowthRunId: string | null;
  conceptIds: string[];
  videoIds: string[];
  queuedForWorker: boolean;
  reusedExisting: boolean;
}> {
  const { data: existing } = await opts.client
    .from("winner_variants")
    .select("child_growth_run_id, spawned_concept_id")
    .eq("source_video_id", opts.sourceVideoId)
    .not("spawned_concept_id", "is", null);
  if (existing?.length && existing.length < 3) {
    throw new Error(
      `winner variant materialization is partial (${existing.length}/3); repair is required before retrying`,
    );
  }
  if (existing?.length) {
    return {
      childGrowthRunId: existing[0]?.child_growth_run_id ?? null,
      conceptIds: existing.flatMap((row) => row.spawned_concept_id ? [row.spawned_concept_id] : []),
      videoIds: [],
      queuedForWorker: Boolean(opts.trustedServiceRole),
      reusedExisting: true,
    };
  }

  const { data: video, error: videoError } = await opts.client
    .from("videos")
    .select("concept_id")
    .eq("id", opts.sourceVideoId)
    .single();
  if (videoError || !video) throw new Error(`winner source video: ${videoError?.message ?? "missing"}`);

  const [{ data: concept, error: conceptError }, { data: sourceRun }, { data: receipt }] = await Promise.all([
    opts.client.from("video_concepts").select("*").eq("id", video.concept_id).single(),
    opts.client.from("growth_runs").select("options, posting_aggressiveness, target_platforms, brand_constraints").eq("id", opts.sourceGrowthRunId).single(),
    opts.client.from("trend_receipts").select("*").eq("concept_id", video.concept_id).maybeSingle(),
  ]);
  if (conceptError || !concept) throw new Error(`winner source concept: ${conceptError?.message ?? "missing"}`);

  const response = await generateObject({
    schema: WinnerVariantBatchSchema,
    schemaDescription: "Exactly three controlled winner hook variants.",
    taskType: "compound",
    system:
      "You multiply a proven short-form video format. Hold format, platform, body promise, CTA, audience, and duration constant. Change only the hook and opening angle.",
    prompt: [
      "Source winning concept:",
      JSON.stringify({
        video_type: concept.video_type,
        platform: concept.platform,
        target_length_seconds: concept.target_length_seconds,
        hook: concept.hook,
        angle: concept.angle,
        promise: concept.promise,
        cta: concept.cta,
        hypothesis: concept.hypothesis,
      }),
      "Trend receipt:",
      JSON.stringify(receipt ?? { confidence: 0, missing_evidence: ["Legacy concept has no Trend Receipt."] }),
      "Return exactly three new hooks. Do not change the format, CTA, audience, promise, platform, or duration.",
    ].join("\n"),
    temperature: 0.5,
  });

  await logAIRun({
    ownerId: opts.ownerId,
    projectId: opts.projectId,
    kind: "winner_variants.materialize",
    provider: response.provider,
    model: response.model,
    status: "success",
    latencyMs: response.latencyMs,
    retryCount: response.retries,
    input: { sourceVideoId: opts.sourceVideoId, sourceGrowthRunId: opts.sourceGrowthRunId },
    parsedOutput: { variants: response.object.variants.length },
  });

  const { data: childRun, error: childRunError } = await opts.client
    .from("growth_runs")
    .insert({
      project_id: opts.projectId,
      parent_run_id: opts.sourceGrowthRunId,
      trigger: opts.trustedServiceRole ? "autopilot" : "manual",
      approval_mode: "manual",
      posting_aggressiveness: sourceRun?.posting_aggressiveness ?? "balanced",
      target_platforms: sourceRun?.target_platforms ?? ([concept.platform] as unknown as Json),
      brand_constraints: sourceRun?.brand_constraints ?? {},
      options: {
        ...asObject(sourceRun?.options),
        winner_source_video_id: opts.sourceVideoId,
        controlled_variable: "hook",
        concept_target_count: 3,
      } as Json,
      status: "running",
      phase: "concepts",
      phase_status: {
        brief: { status: "succeeded", inherited_from: opts.sourceGrowthRunId },
        videotrend: { status: "succeeded", inherited_from: opts.sourceGrowthRunId },
        strategy: { status: "succeeded", inherited_from: opts.sourceGrowthRunId },
        concepts: { status: "running" },
      } as Json,
      started_at: new Date().toISOString(),
    })
    .select("id")
    .single();
  if (childRunError || !childRun) throw new Error(`winner child Growth Run: ${childRunError?.message ?? "missing"}`);

  const formatFingerprintId = receipt?.format_fingerprint_id ?? await createFallbackFingerprint(opts.client, {
    projectId: opts.projectId,
    growthRunId: childRun.id,
    concept,
  });

  const { data: experiment, error: experimentError } = await opts.client
    .from("controlled_experiments")
    .insert({
      project_id: opts.projectId,
      growth_run_id: childRun.id,
      format_fingerprint_id: formatFingerprintId,
      tested_variable: "hook",
      audience_pain: concept.angle ?? "Winning audience pain from the source concept",
      fixed_body: concept.promise ?? "Preserve the winning body and promise",
      fixed_cta: concept.cta ?? "Use the source CTA",
      fixed_audience: "Same audience as the source winner",
      evaluation_window_days: 3,
      status: "planned",
    })
    .select("id")
    .single();
  if (experimentError || !experiment) throw new Error(`winner controlled experiment: ${experimentError?.message ?? "missing"}`);

  const conceptIds: string[] = [];
  for (const variant of response.object.variants) {
    const { data: childConcept, error: insertError } = await opts.client
      .from("video_concepts")
      .insert({
        growth_run_id: childRun.id,
        project_id: opts.projectId,
        video_type: concept.video_type,
        platform: concept.platform,
        target_length_seconds: concept.target_length_seconds,
        hook: variant.hook,
        angle: variant.angle,
        promise: concept.promise,
        cta: concept.cta,
        hypothesis: variant.hypothesis,
        source_pattern_id: concept.source_pattern_id,
        evidence_video_ids: concept.evidence_video_ids,
        status: "draft",
      })
      .select("id")
      .single();
    if (insertError || !childConcept) throw new Error(`winner concept insert: ${insertError?.message ?? "missing"}`);
    conceptIds.push(childConcept.id);

    const [{ error: variantError }, { error: cellError }, { error: receiptError }] = await Promise.all([
      opts.client.from("winner_variants").insert({
        project_id: opts.projectId,
        growth_run_id: opts.sourceGrowthRunId,
        child_growth_run_id: childRun.id,
        source_video_id: opts.sourceVideoId,
        experiment_result_id: opts.experimentResultId,
        variant_type: "hook_swap",
        variant_brief: {
          controlled_variable: "hook",
          variant_label: variant.variant_label,
          expected_signal: variant.expected_signal,
        } as Json,
        spawned_concept_id: childConcept.id,
        status: "generated",
      }),
      opts.client.from("experiment_cells").insert({
        project_id: opts.projectId,
        experiment_id: experiment.id,
        concept_id: childConcept.id,
        variant_label: variant.variant_label,
        variable_value: variant.hook,
        hypothesis: variant.hypothesis,
      }),
      opts.client.from("trend_receipts").insert({
        project_id: opts.projectId,
        growth_run_id: childRun.id,
        concept_id: childConcept.id,
        format_fingerprint_id: formatFingerprintId,
        evidence_video_ids: receipt?.evidence_video_ids ?? concept.evidence_video_ids,
        source_pattern_ids: receipt?.source_pattern_ids ?? (concept.source_pattern_id ? [concept.source_pattern_id] : []),
        observed_evidence: receipt?.observed_evidence ?? ["The source video produced a winner classification."],
        strategic_inference: [variant.hypothesis] as Json,
        expected_signal: variant.expected_signal,
        reasoning: "This is a controlled hook variant of a source video classified as a winner.",
        confidence: receipt?.confidence ?? 0.5,
        missing_evidence: receipt?.missing_evidence ?? ["Legacy winner did not have a full Trend Receipt."],
      }),
    ]);
    if (variantError) throw new Error(`winner_variants insert: ${variantError.message}`);
    if (cellError) throw new Error(`winner experiment cell: ${cellError.message}`);
    if (receiptError) throw new Error(`winner trend receipt: ${receiptError.message}`);
  }

  await opts.client
    .from("growth_runs")
    .update({
      phase_status: {
        brief: { status: "succeeded", inherited_from: opts.sourceGrowthRunId },
        videotrend: { status: "succeeded", inherited_from: opts.sourceGrowthRunId },
        strategy: { status: "succeeded", inherited_from: opts.sourceGrowthRunId },
        concepts: { status: "succeeded", count: conceptIds.length },
        videos: { status: opts.trustedServiceRole ? "pending" : "running" },
      } as Json,
      phase: "videos",
    })
    .eq("id", childRun.id);

  if (opts.trustedServiceRole) {
    return {
      childGrowthRunId: childRun.id,
      conceptIds,
      videoIds: [],
      queuedForWorker: true,
      reusedExisting: false,
    };
  }

  const rendered = await buildVideosForRun({
    growthRunId: childRun.id,
    projectId: opts.projectId,
    conceptIds,
  });
  const readyForReview = rendered.videoIds.length > 0;
  await opts.client
    .from("growth_runs")
    .update({
      status: readyForReview ? "awaiting_approval" : "failed",
      phase: readyForReview ? "approval" : "videos",
      error: readyForReview ? null : rendered.failures.map((failure) => failure.error).join("; "),
      phase_status: {
        concepts: { status: "succeeded", count: conceptIds.length },
        videos: {
          status: readyForReview ? "succeeded" : "failed",
          count: rendered.videoIds.length,
          failures: rendered.failures,
        },
        approval: { status: readyForReview ? "pending" : "skipped" },
      } as Json,
    })
    .eq("id", childRun.id);

  return {
    childGrowthRunId: childRun.id,
    conceptIds,
    videoIds: rendered.videoIds,
    queuedForWorker: false,
    reusedExisting: false,
  };
}

async function createFallbackFingerprint(
  client: Client,
  opts: {
    projectId: string;
    growthRunId: string;
    concept: Database["public"]["Tables"]["video_concepts"]["Row"];
  }
): Promise<string> {
  const { data, error } = await client
    .from("format_fingerprints")
    .insert({
      project_id: opts.projectId,
      growth_run_id: opts.growthRunId,
      name: `${opts.concept.video_type} winner`,
      fingerprint_key: `${opts.concept.video_type}:${opts.concept.platform}:legacy-winner`,
      video_type: opts.concept.video_type,
      platform: opts.concept.platform,
      hook_mechanism: opts.concept.hook,
      visual_grammar: "Inherited from a legacy winner; inspect the rendered source video.",
      script_structure: [] as Json,
      cta_pattern: opts.concept.cta ?? "Unknown CTA",
      business_hypothesis: opts.concept.hypothesis ?? "The source format produced business signal.",
      transferability_score: 0.5,
      distortion_risk: "unknown",
      confidence: 0.35,
      missing_evidence: ["Legacy concept did not have a stored format fingerprint."] as Json,
      evidence_video_ids: opts.concept.evidence_video_ids,
      source_pattern_ids: opts.concept.source_pattern_id ? [opts.concept.source_pattern_id] : [] as Json,
      status: "winner",
    })
    .select("id")
    .single();
  if (error || !data) throw new Error(`fallback fingerprint: ${error?.message ?? "missing"}`);
  return data.id;
}

function asObject(value: Json | undefined): Record<string, Json | undefined> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, Json | undefined>
    : {};
}
