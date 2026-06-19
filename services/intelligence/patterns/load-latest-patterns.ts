import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import type { Database } from "@/lib/supabase/types";

type PatternRow = Database["public"]["Tables"]["market_patterns"]["Row"];
type RunRow = Pick<
  Database["public"]["Tables"]["market_pattern_runs"]["Row"],
  "id" | "status" | "source_count" | "pattern_count" | "created_at" | "completed_at"
>;
type EvidenceRow = Pick<
  Database["public"]["Tables"]["market_pattern_evidence"]["Row"],
  "id" | "pattern_id" | "source_id" | "source_url" | "evidence_field" | "evidence_text"
>;
type SourceScoreRow = Database["public"]["Tables"]["market_pattern_source_scores"]["Row"];

export interface LatestPatternRunData {
  latestRun: RunRow | null;
  patterns: PatternRow[];
  evidence: EvidenceRow[];
  sourceScores: SourceScoreRow[];
}

export async function loadLatestSuccessfulRunPatterns(projectId: string): Promise<LatestPatternRunData> {
  if (!isSupabaseConfigured()) {
    return { latestRun: null, patterns: [], evidence: [], sourceScores: [] };
  }

  const supabase = createSupabaseServerClient();

  const { data: latestRun } = await supabase
    .from("market_pattern_runs")
    .select("id, status, source_count, pattern_count, created_at, completed_at")
    .eq("project_id", projectId)
    .eq("status", "success")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!latestRun) {
    return { latestRun: null, patterns: [], evidence: [], sourceScores: [] };
  }

  const { data: patterns } = await supabase
    .from("market_patterns")
    .select("*")
    .eq("project_id", projectId)
    .eq("run_id", latestRun.id)
    .order("strength_score", { ascending: false });

  const patternIds = (patterns ?? []).map((pattern) => pattern.id);
  if (!patternIds.length) {
    return { latestRun, patterns: [], evidence: [], sourceScores: [] };
  }

  const [{ data: evidence }, { data: sourceScores }] = await Promise.all([
    supabase
      .from("market_pattern_evidence")
      .select("id, pattern_id, source_id, source_url, evidence_field, evidence_text")
      .eq("project_id", projectId)
      .in("pattern_id", patternIds),
    supabase.from("market_pattern_source_scores").select("*").eq("project_id", projectId).in("pattern_id", patternIds),
  ]);

  return {
    latestRun,
    patterns: patterns ?? [],
    evidence: evidence ?? [],
    sourceScores: sourceScores ?? [],
  };
}

export function formatScorePercent(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return `${Math.round(value * 100)}%`;
}

export function scoreBadgeVariant(value: number): "success" | "outline" | "secondary" {
  if (value >= 0.7) return "success";
  if (value >= 0.45) return "outline";
  return "secondary";
}
