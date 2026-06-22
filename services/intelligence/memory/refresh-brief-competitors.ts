import "server-only";

import type { Json } from "@/lib/supabase/types";
import type { BriefConfidenceLevel } from "@/services/autobrief/schema";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { MarketSynthesis } from "../deep-discovery/schema";
import {
  computeCompetitorConfidence,
  mergeBriefCompetitors,
  type BriefCompetitorEntry,
} from "./merge-brief-competitors";

export interface RefreshBriefCompetitorsInput {
  projectId: string;
  synthesis: MarketSynthesis;
}

export interface RefreshBriefCompetitorsResult {
  updated: boolean;
  verifiedCount: number;
  unverifiedCount: number;
  competitorsConfidence: BriefConfidenceLevel;
}

const EMPTY: RefreshBriefCompetitorsResult = {
  updated: false,
  verifiedCount: 0,
  unverifiedCount: 0,
  competitorsConfidence: "low",
};

/**
 * Closes the brief <-> discovery loop: rewrites the brief's competitor section
 * (`likely_competitors`, `competitors`, `confidence.competitors`) from
 * evidence-backed deep-discovery synthesis so the founder reads verified
 * competitors instead of the original model guesses.
 */
export async function refreshBriefCompetitorsFromSynthesis(
  input: RefreshBriefCompetitorsInput
): Promise<RefreshBriefCompetitorsResult> {
  const synthesisCompetitors = input.synthesis?.competitors ?? [];
  if (!synthesisCompetitors.length) return EMPTY;

  const supabase = createSupabaseServerClient();

  const { data: brief } = await supabase
    .from("product_briefs")
    .select("id, likely_competitors, confidence")
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (!brief?.id) return EMPTY;

  const linkedCandidateCounts = await loadLinkedCandidateCounts(supabase, input.projectId);
  const merged: BriefCompetitorEntry[] = mergeBriefCompetitors(
    brief.likely_competitors,
    synthesisCompetitors,
    linkedCandidateCounts
  );
  const competitorsConfidence = computeCompetitorConfidence(merged);

  const existingConfidence =
    brief.confidence && typeof brief.confidence === "object" && !Array.isArray(brief.confidence)
      ? (brief.confidence as Record<string, unknown>)
      : {};

  const nextConfidence = { ...existingConfidence, competitors: competitorsConfidence };

  const { error } = await supabase
    .from("product_briefs")
    .update({
      likely_competitors: merged as unknown as Json,
      competitors: merged.map((c) => c.name) as unknown as Json,
      confidence: nextConfidence as unknown as Json,
    })
    .eq("id", brief.id);

  if (error) {
    console.warn("[brief] competitor refresh failed", error.message);
    return EMPTY;
  }

  return {
    updated: true,
    verifiedCount: merged.filter((c) => c.verification === "verified").length,
    unverifiedCount: merged.filter((c) => c.verification === "unverified").length,
    competitorsConfidence,
  };
}

/**
 * Build a `normalizedName -> linkedCandidateCount` map for the project's
 * competitors. Uses the competitor_id link from Phase 5C to count real
 * evidence rows in source_candidates rather than relying solely on the
 * URLs returned by synthesis.
 */
async function loadLinkedCandidateCounts(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  projectId: string
): Promise<Map<string, number>> {
  const counts = new Map<string, number>();

  const { data: competitorRows } = await supabase
    .from("competitors")
    .select("id, name")
    .eq("project_id", projectId);

  if (!competitorRows?.length) return counts;

  const { data: linkedRows } = await supabase
    .from("source_candidates")
    .select("competitor_id")
    .eq("project_id", projectId)
    .not("competitor_id", "is", null);

  if (!linkedRows?.length) return counts;

  const countById = new Map<string, number>();
  for (const row of linkedRows) {
    if (!row.competitor_id) continue;
    countById.set(row.competitor_id, (countById.get(row.competitor_id) ?? 0) + 1);
  }

  for (const competitor of competitorRows) {
    const count = countById.get(competitor.id) ?? 0;
    if (count > 0) counts.set(competitor.name.trim().toLowerCase().replace(/\s+/g, " "), count);
  }

  return counts;
}
