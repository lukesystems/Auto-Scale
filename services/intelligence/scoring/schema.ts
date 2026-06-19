import { z } from "zod";

export const DistortionRiskSchema = z.enum(["low", "medium", "high"]);
export type DistortionRisk = z.infer<typeof DistortionRiskSchema>;

export const SourceScoreSchema = z.object({
  sourceId: z.string(),
  relevance: z.number().nullable(),
  formatTransferability: z.number().nullable(),
  conversionIntent: z.number().nullable(),
  accountFit: z.number().nullable(),
  signalScore: z.number(),
  confidenceScore: z.number(),
  distortionRisk: DistortionRiskSchema,
  reasons: z.array(z.string()),
});

export type SourceScore = z.infer<typeof SourceScoreSchema>;

export const PatternScoreSchema = z.object({
  strengthScore: z.number(),
  transferabilityScore: z.number(),
  signalConfidence: z.number(),
  scoreReasons: z.array(z.string()),
  sourceScores: z.array(SourceScoreSchema),
});

export type PatternScore = z.infer<typeof PatternScoreSchema>;

export interface ScoredPattern {
  patternIndex: number;
  scores: PatternScore;
}
