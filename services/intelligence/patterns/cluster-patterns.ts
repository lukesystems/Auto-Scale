import { generateObject } from "@/services/ai/runtime";
import type { PatternMiningContext } from "./load-pattern-context";
import type {
  MinedPattern,
  PatternConfidence,
  PatternSignalGroup,
  PatternType,
  SourceSignalBucket,
} from "./schema";
import { MinedPatternSchema, PatternConsolidationSchema } from "./schema";

const FILLER_WORDS = new Set([
  "the",
  "a",
  "an",
  "and",
  "or",
  "to",
  "for",
  "of",
  "in",
  "on",
  "with",
  "your",
  "our",
  "this",
  "that",
  "is",
  "are",
  "it",
]);

export function normalizeSignalText(text: string): string {
  return text
    .toLowerCase()
    .replace(/[^\w\s]/g, " ")
    .split(/\s+/)
    .filter(Boolean)
    .filter((word) => !FILLER_WORDS.has(word))
    .join(" ")
    .trim();
}

export function groupSignalsDeterministically(buckets: SourceSignalBucket[]): PatternSignalGroup[] {
  const groups = new Map<string, PatternSignalGroup>();

  for (const bucket of buckets) {
    for (const patternType of Object.keys(bucket.signals) as PatternType[]) {
      for (const signal of bucket.signals[patternType]) {
        const normalizedKey = normalizeSignalText(signal.text);
        if (!normalizedKey || normalizedKey.length < 4) continue;

        const key = `${patternType}:${normalizedKey}`;
        const existing = groups.get(key);
        if (existing) {
          const duplicate = existing.items.some(
            (item) => item.sourceId === bucket.sourceId && item.field === signal.field
          );
          if (!duplicate) {
            existing.items.push({
              sourceId: bucket.sourceId,
              sourceUrl: bucket.sourceUrl,
              field: signal.field,
              text: signal.text,
            });
          }
          continue;
        }

        groups.set(key, {
          patternType,
          normalizedKey,
          label: signal.text.trim(),
          items: [
            {
              sourceId: bucket.sourceId,
              sourceUrl: bucket.sourceUrl,
              field: signal.field,
              text: signal.text,
            },
          ],
        });
      }
    }
  }

  return [...groups.values()].sort((a, b) => b.items.length - a.items.length);
}

export function confidenceFromSupportCount(count: number): PatternConfidence {
  if (count >= 4) return "high";
  if (count >= 2) return "medium";
  return "low";
}

export function groupToMinedPattern(group: PatternSignalGroup): MinedPattern | null {
  const evidence = group.items.map((item) => ({
    sourceId: item.sourceId,
    sourceUrl: item.sourceUrl,
    evidenceField: item.field,
    evidenceText: item.text,
  }));

  if (!evidence.length) return null;

  const confidence = confidenceFromSupportCount(evidence.length);
  if (confidence !== "low" && evidence.length < 2) return null;

  const sourceIds = [...new Set(evidence.map((item) => item.sourceId))];
  const examples = [...new Set(evidence.map((item) => item.evidenceText))].slice(0, 4);

  return MinedPatternSchema.parse({
    patternType: group.patternType,
    label: group.label,
    summary: `Repeated ${group.patternType} pattern observed across ${sourceIds.length} source(s).`,
    whyItMatters: defaultWhyItMatters(group.patternType),
    howToUse: defaultHowToUse(group.patternType),
    supportCount: sourceIds.length,
    confidence,
    sourceIds,
    examples,
    evidence,
  });
}

export function patternsFromGroups(groups: PatternSignalGroup[]): MinedPattern[] {
  return groups.map(groupToMinedPattern).filter((pattern): pattern is MinedPattern => Boolean(pattern));
}

export async function clusterPatterns(input: {
  groups: PatternSignalGroup[];
  context: PatternMiningContext;
}): Promise<{ patterns: MinedPattern[]; usedAi: boolean }> {
  const deterministic = patternsFromGroups(input.groups);
  if (!deterministic.length) return { patterns: [], usedAi: false };

  try {
    const groupSummary = input.groups
      .slice(0, 30)
      .map(
        (group) =>
          `- key=${group.patternType}:${group.normalizedKey} | type=${group.patternType} | support=${group.items.length} | label="${group.label}"`
      )
      .join("\n");

    const briefLine = input.context.brief?.one_line_description ?? input.context.brief?.product_summary ?? "";

    const result = await generateObject({
      system: `You consolidate grouped market signals into clearer patterns. Rules:
- Do NOT invent patterns or claims outside the grouped evidence.
- Only merge groups that are genuinely similar.
- Every consolidated pattern must reference group_keys from the input list.
- Keep summaries grounded in the evidence labels.`,
      prompt: `[[pattern_mining]]
Product context: ${briefLine || "(unknown)"}

Grouped signals:
${groupSummary}

Merge similar groups into consolidated market patterns. Return group_keys for each pattern.`,
      schema: PatternConsolidationSchema,
      schemaName: "PatternConsolidation",
      taskType: "trendwatch",
      temperature: 0.25,
      maxTokens: 4000,
    });

    const merged = consolidateWithAi(input.groups, result.object.patterns);
    if (merged.length) return { patterns: merged, usedAi: true };
  } catch {
    // deterministic fallback
  }

  return { patterns: deterministic, usedAi: false };
}

function consolidateWithAi(
  groups: PatternSignalGroup[],
  consolidated: Array<{
    pattern_type: PatternType;
    label: string;
    summary: string;
    why_it_matters: string;
    how_to_use: string;
    group_keys: string[];
  }>
): MinedPattern[] {
  const groupByKey = new Map(groups.map((group) => [`${group.patternType}:${group.normalizedKey}`, group]));

  const patterns: MinedPattern[] = [];

  for (const item of consolidated) {
    const matchedGroups = item.group_keys
      .map((key) => groupByKey.get(key.includes(":") ? key : `${item.pattern_type}:${key}`))
      .filter((group): group is PatternSignalGroup => Boolean(group));

    if (!matchedGroups.length) continue;

    const items = matchedGroups.flatMap((group) => group.items);
    const evidence = items.map((entry) => ({
      sourceId: entry.sourceId,
      sourceUrl: entry.sourceUrl,
      evidenceField: entry.field,
      evidenceText: entry.text,
    }));

    const uniqueEvidence = dedupeEvidence(evidence);
    if (!uniqueEvidence.length) continue;

    const confidence = confidenceFromSupportCount(uniqueEvidence.length);
    if (confidence !== "low" && uniqueEvidence.length < 2) continue;

    const sourceIds = [...new Set(uniqueEvidence.map((entry) => entry.sourceId))];

    patterns.push(
      MinedPatternSchema.parse({
        patternType: item.pattern_type,
        label: item.label,
        summary: item.summary,
        whyItMatters: item.why_it_matters,
        howToUse: item.how_to_use,
        supportCount: sourceIds.length,
        confidence,
        sourceIds,
        examples: [...new Set(uniqueEvidence.map((entry) => entry.evidenceText))].slice(0, 4),
        evidence: uniqueEvidence,
      })
    );
  }

  return patterns;
}

function dedupeEvidence(
  evidence: Array<{
    sourceId: string;
    sourceUrl: string | null;
    evidenceField: string;
    evidenceText: string;
  }>
) {
  const seen = new Set<string>();
  return evidence.filter((entry) => {
    const key = `${entry.sourceId}:${entry.evidenceField}:${normalizeSignalText(entry.evidenceText)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function defaultWhyItMatters(type: PatternType): string {
  const map: Record<PatternType, string> = {
    hook: "Repeated hooks show what stops the scroll for this audience.",
    pain: "Repeated pains show what the market keeps complaining about.",
    angle: "Repeated angles show how competitors frame the problem.",
    format: "Repeated formats show what content shapes appear to work.",
    cta: "Repeated CTAs show how the market asks for action.",
    visual: "Repeated visual patterns show how winners package the message.",
    offer: "Repeated offers show how products are being sold in public.",
    positioning: "Repeated positioning shows how winners describe themselves.",
  };
  return map[type];
}

function defaultHowToUse(type: PatternType): string {
  const map: Record<PatternType, string> = {
    hook: "Test a founder-native variant of this hook in your next post.",
    pain: "Name this pain explicitly in your next experiment.",
    angle: "Borrow the framing, not the exact wording.",
    format: "Prototype this format with your own product evidence.",
    cta: "Use a similar CTA shape with your own offer.",
    visual: "Mirror the visual structure using your product screenshots.",
    offer: "Compare your offer against this public pattern.",
    positioning: "Stress-test your positioning against this repeated claim.",
  };
  return map[type];
}

export function filterPatternsWithEvidence(patterns: MinedPattern[]): MinedPattern[] {
  return patterns.filter((pattern) => {
    if (!pattern.evidence.length) return false;
    if (pattern.confidence === "low") return pattern.evidence.length >= 1;
    return pattern.evidence.length >= 2;
  });
}
