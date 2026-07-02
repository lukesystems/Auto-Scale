import { z } from "zod";
import { coercePatternType, coerceToString } from "@/services/ai/coerce-llm-output";

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
  patterns: z.preprocess(
    (val) => {
      const rows = Array.isArray(val) ? val : [];
      return rows.map((row) => {
        if (!row || typeof row !== "object" || Array.isArray(row)) {
          return {
            pattern_type: "angle",
            label: "Observed pattern",
            summary: "Pattern from sources",
            why_it_matters: "May inform hook and angle tests",
            how_to_use: "Adapt to product brief with evidence",
            group_keys: ["fallback"],
          };
        }
        const r = row as Record<string, unknown>;
        const summary =
          coerceToString(r.summary) ||
          coerceToString(r.pattern) ||
          coerceToString(r.label) ||
          "Observed pattern";
        return {
          pattern_type: coercePatternType(r.pattern_type ?? r.patternType ?? r.type),
          label: coerceToString(r.label) || summary.slice(0, 80),
          summary,
          why_it_matters:
            coerceToString(r.why_it_matters) ||
            coerceToString(r.whyItMatters) ||
            "Relevant to niche content performance",
          how_to_use:
            coerceToString(r.how_to_use) ||
            coerceToString(r.howToUse) ||
            "Test in controlled hook variants",
          group_keys: Array.isArray(r.group_keys)
            ? r.group_keys.map((k) => coerceToString(k)).filter(Boolean)
            : ["ungrouped"],
        };
      });
    },
    z.array(
      z.object({
        pattern_type: PatternTypeSchema,
        label: z.string(),
        summary: z.string(),
        why_it_matters: z.string(),
        how_to_use: z.string(),
        group_keys: z.array(z.string()).min(1),
      })
    )
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
