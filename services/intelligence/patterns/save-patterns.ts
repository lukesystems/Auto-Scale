import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MinedPattern } from "./schema";

export async function savePatterns(input: {
  runId: string;
  projectId: string;
  patterns: MinedPattern[];
}): Promise<string[]> {
  if (!input.patterns.length) return [];

  const supabase = createSupabaseServerClient();
  const patternIds: string[] = [];

  for (const pattern of input.patterns) {
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
  }

  return patternIds;
}
