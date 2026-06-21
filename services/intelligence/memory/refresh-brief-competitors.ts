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

  const merged: BriefCompetitorEntry[] = mergeBriefCompetitors(brief.likely_competitors, synthesisCompetitors);
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
