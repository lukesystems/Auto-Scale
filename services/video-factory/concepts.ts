import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { logAIRun } from "@/services/ai/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { loadProductBrief } from "@/services/growth-run/repository";
import {
  VideoConceptBatchSchema,
  type GrowthRunOptions,
  type PostingLoadout,
  type VideoStrategy,
  type VideoTrendReport,
} from "@/services/growth-run/schema";

/**
 * Generate 10-30 video concepts for a Growth Run, weighted by the strategy
 * mix and the loadout's total volume. Concepts persist as `video_concepts`
 * rows in 'draft' status — script + storyboard come next.
 */
export async function generateVideoConcepts(opts: {
  projectId: string;
  growthRunId: string;
  ownerId: string;
  trendReport: VideoTrendReport;
  strategy: VideoStrategy;
  loadout: PostingLoadout;
  options: GrowthRunOptions;
}): Promise<{ conceptIds: string[] }> {
  const brief = await loadProductBrief(opts.projectId);
  const targetCount = Math.min(
    Math.max(opts.loadout.total_videos_planned, opts.options.concept_target_count),
    30
  );

  const platformPriority = Object.entries(opts.strategy.platform_mix)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([p]) => p);
  const typePriority = Object.entries(opts.strategy.video_type_mix)
    .sort((a, b) => Number(b[1]) - Number(a[1]))
    .map(([t]) => t);

  const prompt = [
    "You are AutoScale's Video Concept generator.",
    `Produce exactly ${targetCount} distinct short-form video concepts.`,
    "Weight by the strategy: platform mix and video-type mix.",
    "Each concept must be a real testable experiment, not a vague topic.",
    "",
    "Product brief:",
    JSON.stringify({
      product: brief?.product_name ?? brief?.one_line_description ?? null,
      target_customer: brief?.target_customer ?? null,
      primary_pain: brief?.primary_pain ?? null,
      core_promise: brief?.core_promise ?? null,
      cta: brief?.cta ?? null,
    }),
    "",
    "Trend report (winning structures + hooks + CTAs):",
    JSON.stringify({
      winning_structures: opts.trendReport.winning_structures.slice(0, 6),
      hook_patterns: opts.trendReport.hook_patterns.slice(0, 12),
      cta_patterns: opts.trendReport.cta_patterns.slice(0, 6),
      recommended_experiments: opts.trendReport.recommended_experiments.slice(0, 8),
      audience_language: opts.trendReport.audience_language.slice(0, 12),
    }),
    "",
    "Strategy mix (highest weight first):",
    `platform_priority = ${JSON.stringify(platformPriority)}`,
    `video_type_priority = ${JSON.stringify(typePriority)}`,
    "",
    "Return JSON: { concepts: VideoConcept[] }. Each concept:",
    "- video_type (one of: slide, demo, founder_pov, pain_led, trend_remix, ai_broll, objection, comparison)",
    "- platform (one of: tiktok, instagram, youtube)",
    "- target_length_seconds (8..60)",
    "- hook (max 18 words, scroll-stopping)",
    "- angle (one sentence)",
    "- promise (what the viewer will get by the end)",
    "- cta (the action requested)",
    "- hypothesis (the testable belief this video proves or disproves)",
    "",
    "No two concepts may share the same hook. Vary opening frames.",
  ].join("\n");

  const res = await generateObject({
    schema: VideoConceptBatchSchema,
    schemaDescription:
      "{ concepts: VideoConcept[] } where VideoConcept includes video_type, platform, target_length_seconds, hook, angle, promise, cta, hypothesis.",
    taskType: "content",
    system: "You generate distinct short-form video concepts. No duplicates. No vagueness.",
    prompt,
    temperature: 0.7,
    maxTokens: 4000,
  });

  await logAIRun({
    ownerId: opts.ownerId,
    projectId: opts.projectId,
    kind: "video_concepts.batch",
    provider: res.provider,
    model: res.model,
    status: "success",
    latencyMs: res.latencyMs,
    retryCount: res.retries,
    input: { targetCount },
    parsedOutput: { count: res.object.concepts.length },
  });

  const supabase = createSupabaseServerClient();
  const rows = res.object.concepts.map((c) => ({
    growth_run_id: opts.growthRunId,
    project_id: opts.projectId,
    video_type: c.video_type,
    platform: c.platform,
    target_length_seconds: c.target_length_seconds,
    hook: c.hook,
    angle: c.angle,
    promise: c.promise,
    cta: c.cta,
    hypothesis: c.hypothesis,
    status: "draft" as const,
  }));
  const { data, error } = await supabase.from("video_concepts").insert(rows).select("id");
  if (error) throw new Error(`video_concepts insert: ${error.message}`);
  return { conceptIds: (data ?? []).map((r) => r.id) };
}
