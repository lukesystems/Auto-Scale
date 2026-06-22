import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import {
  linkCandidatesByEntity,
  type CompetitorIdentity,
} from "../entity-resolution/match-competitor";

export interface LinkCandidatesInput {
  projectId: string;
  /** Limit linking to candidates of this discovery run, when provided. */
  discoveryRunId?: string | null;
}

export interface LinkCandidatesResult {
  candidatesLinked: number;
  competitorsTouched: number;
}

/**
 * After deep-discovery synthesis promotes competitors, walk the project's
 * source_candidates and attach competitor_id wherever the candidate's URL
 * shares an entity key with a known competitor. Idempotent: never overwrites
 * an existing link.
 */
export async function linkCandidatesToCompetitors(
  input: LinkCandidatesInput
): Promise<LinkCandidatesResult> {
  const supabase = createSupabaseServerClient();

  const { data: competitorRows } = await supabase
    .from("competitors")
    .select("id, name, entity_key, evidence_urls")
    .eq("project_id", input.projectId);

  const competitors: CompetitorIdentity[] = (competitorRows ?? []).map((row) => ({
    id: row.id,
    name: row.name,
    entityKey: row.entity_key ?? null,
    evidenceUrls: parseEvidenceUrls(row.evidence_urls),
  }));

  if (!competitors.length) return { candidatesLinked: 0, competitorsTouched: 0 };

  let candidatesQuery = supabase
    .from("source_candidates")
    .select("id, url, canonical_url")
    .eq("project_id", input.projectId)
    .is("competitor_id", null);

  if (input.discoveryRunId) {
    candidatesQuery = candidatesQuery.eq("discovery_run_id", input.discoveryRunId);
  }

  const { data: candidateRows } = await candidatesQuery;
  if (!candidateRows?.length) return { candidatesLinked: 0, competitorsTouched: 0 };

  const links = linkCandidatesByEntity(
    candidateRows.map((row) => ({ id: row.id, url: row.canonical_url ?? row.url })),
    competitors
  );

  if (!links.size) return { candidatesLinked: 0, competitorsTouched: 0 };

  // Group updates by competitor_id so each call updates many rows at once
  // instead of issuing a separate query per candidate.
  const groupedByCompetitor = new Map<string, string[]>();
  for (const [candidateId, competitorId] of links) {
    const list = groupedByCompetitor.get(competitorId) ?? [];
    list.push(candidateId);
    groupedByCompetitor.set(competitorId, list);
  }

  let candidatesLinked = 0;
  for (const [competitorId, candidateIds] of groupedByCompetitor) {
    const { error } = await supabase
      .from("source_candidates")
      .update({ competitor_id: competitorId })
      .in("id", candidateIds);

    if (error) {
      console.warn("[link-candidates] update failed", competitorId, error.message);
      continue;
    }
    candidatesLinked += candidateIds.length;
  }

  return {
    candidatesLinked,
    competitorsTouched: groupedByCompetitor.size,
  };
}

function parseEvidenceUrls(value: unknown): string[] {
  if (!Array.isArray(value)) return [];
  return value.filter((item): item is string => typeof item === "string");
}
