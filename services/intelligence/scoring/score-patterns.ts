import { clamp } from "@/services/trendwatch/scoring";
import type { MineableSourceRow } from "../patterns/load-pattern-context";
import type { PatternMiningContext } from "../patterns/load-pattern-context";
import type { MinedPattern, PatternConfidence } from "../patterns/schema";
import type { PatternScore, ScoredPattern } from "./schema";
import { scoreSource } from "./score-source";

const CONFIDENCE_WEIGHT: Record<PatternConfidence, number> = {
  low: 0.33,
  medium: 0.66,
  high: 1,
};

function average(values: number[]): number {
  if (!values.length) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function repetitionScore(supportCount: number): number {
  return clamp(supportCount / 5);
}

export function scorePattern(
  pattern: MinedPattern,
  sourcesById: Map<string, MineableSourceRow>,
  context: PatternMiningContext,
  sourceScoreCache: Map<string, ReturnType<typeof scoreSource>>
): PatternScore {
  const uniqueSourceIds = [...new Set(pattern.sourceIds.length ? pattern.sourceIds : pattern.evidence.map((e) => e.sourceId))];

  const sourceScores = uniqueSourceIds
    .map((sourceId) => {
      const source = sourcesById.get(sourceId);
      if (!source) return null;

      const cached = sourceScoreCache.get(sourceId);
      if (cached) return cached;

      const scored = scoreSource(source, context);
      sourceScoreCache.set(sourceId, scored);
      return scored;
    })
    .filter((score): score is NonNullable<typeof score> => score !== null);

  const avgSignalScore = average(sourceScores.map((score) => score.signalScore));
  const avgConfidence = average(sourceScores.map((score) => score.confidenceScore));
  const avgTransferability = average(
    sourceScores
      .map((score) => score.formatTransferability)
      .filter((value): value is number => value !== null)
  );

  const repetition = repetitionScore(pattern.supportCount);
  let strengthScore = 0.6 * repetition + 0.4 * avgSignalScore;

  if (pattern.confidence === "high") strengthScore += 0.05;
  strengthScore = clamp(strengthScore);

  let transferabilityScore = avgTransferability || 0.4;
  if (pattern.howToUse?.trim()) transferabilityScore += 0.1;
  transferabilityScore = clamp(transferabilityScore);

  const evidenceFactor = clamp(pattern.evidence.length / 3);
  const signalConfidence = clamp(
    0.5 * avgConfidence + 0.3 * CONFIDENCE_WEIGHT[pattern.confidence] + 0.2 * evidenceFactor
  );

  const scoreReasons: string[] = [
    `Strength blends repetition (${Math.round(repetition * 100)}%) with avg source signal (${Math.round(avgSignalScore * 100)}%).`,
    `Transferability averages source format adaptability (${Math.round((avgTransferability || 0) * 100)}%).`,
    `Confidence reflects ${pattern.confidence} pattern confidence, ${pattern.evidence.length} evidence item(s), and metric coverage.`,
  ];

  if (sourceScores.some((score) => score.confidenceScore < 0.55)) {
    scoreReasons.push("Some contributing sources lack save/recency metrics — confidence is capped.");
  }

  return {
    strengthScore: Math.round(strengthScore * 100) / 100,
    transferabilityScore: Math.round(transferabilityScore * 100) / 100,
    signalConfidence: Math.round(signalConfidence * 100) / 100,
    scoreReasons,
    sourceScores,
  };
}

export function scorePatterns(
  patterns: MinedPattern[],
  sources: MineableSourceRow[],
  context: PatternMiningContext
): ScoredPattern[] {
  const sourcesById = new Map(sources.map((source) => [source.id, source]));
  const sourceScoreCache = new Map<string, ReturnType<typeof scoreSource>>();

  return patterns.map((pattern, patternIndex) => ({
    patternIndex,
    scores: scorePattern(pattern, sourcesById, context, sourceScoreCache),
  }));
}
