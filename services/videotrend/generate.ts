import "server-only";

import { generateObject } from "@/services/ai/runtime";
import { logAIRun } from "@/services/ai/logger";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  loadVideoEvidence,
  loadVideoPatterns,
  loadProductBrief,
} from "@/services/growth-run/repository";
import { VideoTrendReportSchema, type VideoTrendReport } from "@/services/growth-run/schema";
import { validateHookPatterns } from "./validate-hook-patterns";

/**
 * VideoTrend Agent.
 *
 * Wraps the existing video_evidence + video_patterns intelligence into a
 * structured VideoTrendReport for a Growth Run. This is the single source
 * of truth fed into the Video Strategy and Script generators downstream.
 *
 * The doc was explicit: "VideoTrend must output video patterns, not just
 * topic ideas." Output shape enforces winning structures, hooks, opening
 * frames, CTA patterns, platform patterns, competitor gaps, repurposable
 * formats — exactly what the strategy agent needs.
 */

export async function generateVideoTrendReport(opts: {
  projectId: string;
  growthRunId: string;
  ownerId: string;
  lowConfidenceEvidence?: boolean;
  evidenceCount?: number;
}): Promise<{
  report: VideoTrendReport;
  evidenceVideoIds: string[];
  recordId: string;
  hookValidation?: ReturnType<typeof validateHookPatterns>["validation"];
}> {
  const supabase = createSupabaseServerClient();
  const { data: existingRow } = await supabase
    .from("video_trend_reports")
    .select("*")
    .eq("growth_run_id", opts.growthRunId)
    .maybeSingle();

  if (existingRow) {
    const report: VideoTrendReport = {
      winning_structures: existingRow.winning_structures as never,
      hook_patterns: existingRow.hook_patterns as never,
      opening_frames: existingRow.opening_frames as never,
      cta_patterns: existingRow.cta_patterns as never,
      audience_language: existingRow.audience_language as never,
      platform_patterns: existingRow.platform_patterns as never,
      recommended_experiments: existingRow.recommended_experiments as never,
      competitor_gaps: existingRow.competitor_gaps as never,
      repurposable_formats: existingRow.repurposable_formats as never,
      confidence: existingRow.confidence ?? 0.5,
    };
    return {
      report,
      evidenceVideoIds: (existingRow.evidence_video_ids as string[]) ?? [],
      recordId: existingRow.id,
    };
  }

  const [brief, evidence, patterns] = await Promise.all([
    loadProductBrief(opts.projectId),
    loadVideoEvidence(opts.projectId, 80),
    loadVideoPatterns(opts.projectId),
  ]);

  // Compact evidence packets so the prompt stays small.
  const evidencePackets = evidence.slice(0, 40).map((e) => ({
    id: e.id,
    url: e.video_url,
    platform: e.platform,
    handle: e.account_handle ?? null,
    hook: e.detected_hook ?? null,
    cta: e.detected_cta ?? null,
    format: e.format_guess ?? null,
    topic: e.topic_guess ?? null,
    duration: e.duration_seconds ?? null,
    views: e.view_count ?? null,
    likes: e.like_count ?? null,
    shares: e.share_count ?? null,
    caption: (e.caption ?? "").slice(0, 240),
  }));

  const patternPackets = patterns.slice(0, 60).map((p) => ({
    type: p.pattern_type,
    label: p.label,
    description: (p.description ?? "").slice(0, 240),
    evidence_count: p.evidence_count,
    confidence: p.confidence,
  }));

  const briefPacket = brief
    ? {
        product: brief.product_name ?? brief.one_line_description ?? null,
        target_customer: brief.target_customer ?? null,
        primary_pain: brief.primary_pain ?? null,
        cta: brief.cta ?? null,
      }
    : null;

  const prompt = [
    "You are AutoScale's VideoTrend Agent.",
    "You output reusable short-form video patterns for TikTok / Instagram Reels / YouTube Shorts.",
    "Be evidence-driven. Do not invent metrics. Where evidence is thin, set confidence accordingly.",
    "",
    "Product brief:",
    JSON.stringify(briefPacket),
    "",
    "Recent video evidence (truncated):",
    JSON.stringify(evidencePackets),
    "",
    "Mined patterns (truncated):",
    JSON.stringify(patternPackets),
    "",
    "Produce a strict JSON object matching the VideoTrendReport schema:",
    "- winning_structures[]: named beat sequences (e.g. 'Painful manual → product shortcut → result reveal')",
    "- hook_patterns[]: reusable opening hook templates — every item MUST include reference_url (a video_url from the evidence packets that inspired the hook)",
    "- opening_frames[]: 0-2s visual ideas that earn the watch",
    "- cta_patterns[]: closing calls to action",
    "- platform_patterns[]: per-platform length/aspect/notes",
    "- recommended_experiments[]: concrete hypotheses to test next",
    "- competitor_gaps[]: angles competitors are not covering",
    "- repurposable_formats[]: formats that translate across platforms",
    "- audience_language[]: phrases the target actually uses",
    "- confidence: 0..1, lower when evidence is sparse.",
    "",
    "Nadia rules:",
    "- Prefer hooks derived from shadow/creator accounts (10k–250k followers) over mega-account distortion.",
    "- Every hook_patterns[].reference_url must be an exact url from the evidence packets — never invent URLs.",
  ].join("\n");

  let result: VideoTrendReport;
  let raw = "";
  let hookValidation: ReturnType<typeof validateHookPatterns>["validation"] | undefined;
  try {
    const res = await generateObject({
      schema: VideoTrendReportSchema,
      schemaDescription:
        `VideoTrendReport with this exact shape and lowercase enum values:
{
  "winning_structures": [{"name":"string","beats":["beat 1","beat 2"],"ideal_length_seconds":22,"why_it_works":"string"}],
  "hook_patterns": [{"label":"string","pattern":"string","reference_url":"https://...","example":"string","when_to_use":"string"}],
  "opening_frames": ["string"],
  "cta_patterns": [{"label":"string","pattern":"string","best_for":["string"]}],
  "audience_language": ["string"],
  "platform_patterns": [{"platform":"tiktok|instagram|youtube","preferred_length_seconds":[15,30],"preferred_aspect_ratio":"9:16","notes":"string"}],
  "recommended_experiments": [{"hypothesis":"string","video_type":"slide|demo|founder_pov|pain_led|trend_remix|ai_broll|objection|comparison","platform":"tiktok|instagram|youtube","ideal_length_seconds":22,"estimated_variants":3,"rationale":"string"}],
  "competitor_gaps": ["string"],
  "repurposable_formats": ["string"],
  "confidence": 0.5
}`,
      taskType: "videotrend_reasoning",
      system:
        "You convert real video evidence into reusable short-form video patterns. Never invent metrics or URLs. Every hook_patterns item must cite a reference_url from the supplied evidence packets.",
      prompt,
      temperature: 0.4,
      maxTokens: 5000,
    });
    const validated = validateHookPatterns(res.object, evidencePackets);
    hookValidation = validated.validation;
    result = {
      ...res.object,
      hook_patterns: validated.hook_patterns,
      confidence: validated.confidence,
    };
    raw = res.raw;
    await logAIRun({
      ownerId: opts.ownerId,
      projectId: opts.projectId,
      kind: "videotrend.report",
      provider: res.provider,
      model: res.model,
      status: "success",
      latencyMs: res.latencyMs,
      retryCount: res.retries,
      input: { evidenceCount: evidencePackets.length, patternCount: patternPackets.length },
      parsedOutput: res.object,
    });
  } catch (err) {
    await logAIRun({
      ownerId: opts.ownerId,
      projectId: opts.projectId,
      kind: "videotrend.report",
      provider: "openrouter",
      model: "unknown",
      status: "failed",
      input: { evidenceCount: evidencePackets.length },
      errorMessage: err instanceof Error ? err.message : String(err),
    });
    throw err;
  }

  if (opts.lowConfidenceEvidence) {
    result = {
      ...result,
      confidence: Math.min(result.confidence, 0.35),
    };
  }

  const evidenceVideoIds = evidence.slice(0, 40).map((e) => e.id);
  const insertRow = {
    growth_run_id: opts.growthRunId,
    project_id: opts.projectId,
    winning_structures: result.winning_structures as never,
    hook_patterns: result.hook_patterns as never,
    opening_frames: result.opening_frames as never,
    cta_patterns: result.cta_patterns as never,
    audience_language: result.audience_language as never,
    platform_patterns: result.platform_patterns as never,
    recommended_experiments: result.recommended_experiments as never,
    competitor_gaps: result.competitor_gaps as never,
    repurposable_formats: result.repurposable_formats as never,
    evidence_video_ids: evidenceVideoIds as never,
    confidence: result.confidence,
    raw_output: {
      text: raw,
      low_confidence_evidence: opts.lowConfidenceEvidence ?? false,
      evidence_count: opts.evidenceCount ?? evidencePackets.length,
      hook_validation: hookValidation ?? null,
    } as never,
  };

  // The report is the product of an expensive multi-model phase; do not let a
  // transient network blip to Supabase discard it. Retry fetch-level failures.
  let lastMessage = "";
  for (let attempt = 1; attempt <= 3; attempt++) {
    const { data, error } = await supabase
      .from("video_trend_reports")
      .insert(insertRow)
      .select("id")
      .single();
    if (!error) {
      return { report: result, evidenceVideoIds, recordId: data!.id, hookValidation };
    }
    lastMessage = error.message;
    const transient = /fetch failed|ECONNRESET|ETIMEDOUT|522|network/i.test(lastMessage);
    if (!transient || attempt === 3) break;
    await new Promise((resolve) => setTimeout(resolve, attempt * 2000));
  }
  throw new Error(`video_trend_reports insert failed: ${lastMessage}`);
}
