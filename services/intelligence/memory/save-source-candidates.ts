import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export interface SourceCandidateInput {
  discoveryRunId: string;
  projectId: string;
  url: string;
  canonicalUrl?: string | null;
  title?: string | null;
  snippet?: string | null;
  sourceType?: string;
  platform?: string;
  adapter?: string;
  discoveryQuery?: string | null;
  discoveryReason?: string | null;
  relevanceScore?: number;
  enrichStatus?: "pending" | "enriched" | "failed" | "skipped" | "deep_enriched";
  metadata?: Json;
}

function normalizeEnrichStatus(
  status: SourceCandidateInput["enrichStatus"]
): "pending" | "enriched" | "failed" | "skipped" {
  if (status === "deep_enriched") return "enriched";
  return status ?? "pending";
}

export async function saveSourceCandidates(candidates: SourceCandidateInput[]): Promise<string[]> {
  if (!candidates.length) return [];

  const supabase = createSupabaseServerClient();

  const rows = candidates.map((candidate) => ({
    discovery_run_id: candidate.discoveryRunId,
    project_id: candidate.projectId,
    url: candidate.url,
    canonical_url: candidate.canonicalUrl ?? candidate.url,
    title: candidate.title ?? null,
    snippet: candidate.snippet ?? null,
    source_type: candidate.sourceType ?? "unknown",
    platform: candidate.platform ?? "other",
    adapter: candidate.adapter ?? "exa",
    discovery_query: candidate.discoveryQuery ?? null,
    discovery_reason: candidate.discoveryReason ?? null,
    relevance_score: candidate.relevanceScore ?? 0,
    enrich_status: normalizeEnrichStatus(candidate.enrichStatus),
    metadata: (candidate.metadata ?? {}) as Json,
  }));

  const { data, error } = await supabase.from("source_candidates").insert(rows).select("id");

  if (error) throw new Error(error.message);
  return (data ?? []).map((row) => row.id);
}
