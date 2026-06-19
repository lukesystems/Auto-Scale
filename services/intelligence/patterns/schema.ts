import { z } from "zod";

export const PatternTypeSchema = z.enum([
  "hook",
  "pain",
  "angle",
  "format",
  "cta",
  "visual",
  "offer",
  "positioning",
]);

export type PatternType = z.infer<typeof PatternTypeSchema>;

export const PatternConfidenceSchema = z.enum(["low", "medium", "high"]);
export type PatternConfidence = z.infer<typeof PatternConfidenceSchema>;

export const SignalEvidenceSchema = z.object({
  sourceId: z.string(),
  sourceUrl: z.string().nullable(),
  evidenceField: z.string(),
  evidenceText: z.string(),
});

export const MinedPatternSchema = z.object({
  patternType: PatternTypeSchema,
  label: z.string(),
  summary: z.string(),
  whyItMatters: z.string(),
  howToUse: z.string(),
  supportCount: z.number().int().min(1),
  confidence: PatternConfidenceSchema,
  sourceIds: z.array(z.string()),
  examples: z.array(z.string()),
  evidence: z.array(SignalEvidenceSchema).min(1),
});

export type MinedPattern = z.infer<typeof MinedPatternSchema>;

export const PatternConsolidationSchema = z.object({
  patterns: z.array(
    z.object({
      pattern_type: PatternTypeSchema,
      label: z.string(),
      summary: z.string(),
      why_it_matters: z.string(),
      how_to_use: z.string(),
      group_keys: z.array(z.string()).min(1),
    })
  ),
});

export type PatternConsolidation = z.infer<typeof PatternConsolidationSchema>;

export interface SourceSignalBucket {
  sourceId: string;
  sourceUrl: string | null;
  platform: string;
  signals: Record<PatternType, Array<{ text: string; field: string }>>;
}

export interface PatternSignalGroup {
  patternType: PatternType;
  normalizedKey: string;
  label: string;
  items: Array<{
    sourceId: string;
    sourceUrl: string | null;
    field: string;
    text: string;
  }>;
}
