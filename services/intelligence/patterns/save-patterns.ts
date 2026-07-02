import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MinedPattern, PatternType } from "./schema";
import type { PatternScore } from "../scoring/schema";

const VIDEO_PATTERN_TYPE_MAP: Partial<
  Record<PatternType, "hook" | "format" | "cta" | "topic" | "cadence" | "link">
> = {
  hook: "hook",
  format: "format",
  cta: "cta",
  visual: "format",
  angle: "topic",
  pain: "topic",
  positioning: "topic",
  offer: "topic",
};

export interface PatternWithScores {
  pattern: MinedPattern;
  scores: PatternScore;
}

export async function savePatterns(input: {
  runId: string;
  projectId: string;
  patterns: PatternWithScores[];
}): Promise<string[]> {
  if (!input.patterns.length) return [];

  const supabase = createSupabaseServerClient();
  const patternIds: string[] = [];

  for (const { pattern, scores } of input.patterns) {
    if (!pattern.evidence.length) continue;

    const { data: savedPattern, error } = await supabase
      .from("market_patterns")
      .insert({
        run_id: input.runId,
        project_id: input.projectId,
        pattern_type: pattern.patternType,
        label: pattern.label,
        summary: pattern.summary,
        why_it_matters: pattern.whyItMatters,
        how_to_use: pattern.howToUse,
        support_count: pattern.supportCount,
        confidence: pattern.confidence,
        source_ids: pattern.sourceIds as Json,
        examples: pattern.examples as Json,
        strength_score: scores.strengthScore,
        transferability_score: scores.transferabilityScore,
        signal_confidence: scores.signalConfidence,
        score_reasons: scores.scoreReasons as Json,
        metadata: {} as Json,
      })
      .select("id")
      .single();

    if (error || !savedPattern) {
      throw new Error(error?.message ?? "Failed to save market pattern.");
    }

    patternIds.push(savedPattern.id);

    const { error: evidenceError } = await supabase.from("market_pattern_evidence").insert(
      pattern.evidence.map((item) => ({
        pattern_id: savedPattern.id,
        source_id: item.sourceId,
        project_id: input.projectId,
        source_url: item.sourceUrl,
        evidence_field: item.evidenceField,
        evidence_text: item.evidenceText,
      }))
    );

    if (evidenceError) throw new Error(evidenceError.message);

    await syncVideoPattern({
      projectId: input.projectId,
      pattern,
      marketPatternId: savedPattern.id,
    });

    if (scores.sourceScores.length) {
      const { error: sourceScoreError } = await supabase.from("market_pattern_source_scores").insert(
        scores.sourceScores.map((sourceScore) => ({
          pattern_id: savedPattern.id,
          source_id: sourceScore.sourceId,
          project_id: input.projectId,
          relevance: sourceScore.relevance,
          format_transferability: sourceScore.formatTransferability,
          conversion_intent: sourceScore.conversionIntent,
          account_fit: sourceScore.accountFit,
          signal_score: sourceScore.signalScore,
          confidence_score: sourceScore.confidenceScore,
          distortion_risk: sourceScore.distortionRisk,
          reasons: sourceScore.reasons as Json,
        }))
      );

      if (sourceScoreError) throw new Error(sourceScoreError.message);
    }
  }

  return patternIds;
}

async function syncVideoPattern(input: {
  projectId: string;
  pattern: MinedPattern;
  marketPatternId: string;
}): Promise<void> {
  const videoPatternType = VIDEO_PATTERN_TYPE_MAP[input.pattern.patternType];
  if (!videoPatternType) return;

  const supabase = createSupabaseServerClient();
  const sourceIds = input.pattern.sourceIds;
  const { data: sources } = await supabase
    .from("trendwatch_sources")
    .select("id, fetch_metadata")
    .in("id", sourceIds);

  const videoEvidenceIds = (sources ?? [])
    .map((source) => {
      const meta = source.fetch_metadata as { video_evidence_id?: string } | null;
      return typeof meta?.video_evidence_id === "string" ? meta.video_evidence_id : null;
    })
    .filter((id): id is string => Boolean(id));

  const confidence =
    input.pattern.confidence === "high" ? 0.85 : input.pattern.confidence === "medium" ? 0.65 : 0.45;

  const { error } = await supabase.from("video_patterns").insert({
    project_id: input.projectId,
    pattern_type: videoPatternType,
    label: input.pattern.label,
    description: input.pattern.summary,
    evidence_count: input.pattern.supportCount,
    confidence,
    metadata: {
      market_pattern_id: input.marketPatternId,
      source_ids: sourceIds,
      video_evidence_ids: videoEvidenceIds,
      evidence: input.pattern.evidence,
    } as Json,
  });

  if (error) console.warn("[pattern-mining] video_patterns sync failed", error.message);
}
