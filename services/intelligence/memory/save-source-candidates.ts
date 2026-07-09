import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { primaryEntityKey } from "../entity-resolution/entity-key";
import type { SearchResultEngagement } from "../types";

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
  accountType?: string | null;
  engagement?: SearchResultEngagement | null;
  postedAt?: string | null;
  metadata?: Json;
}

function normalizeEnrichStatus(
  status: SourceCandidateInput["enrichStatus"]
): "pending" | "enriched" | "failed" | "skipped" {
  if (status === "deep_enriched") return "enriched";
  return status ?? "pending";
}

/** Values allowed by the source_candidates_source_type_check DB constraint. */
const DB_SOURCE_TYPES = new Set([
  "competitor", "creator", "community", "review", "comparison",
  "social_post", "article", "video", "unknown",
]);

/** inferSourceType emits finer-grained values than the DB column accepts. */
const SOURCE_TYPE_TO_DB: Record<string, string> = {
  competitor_homepage: "competitor",
  competitor_pricing: "competitor",
  competitor_blog: "competitor",
  community_pain: "community",
  creator_account: "creator",
  documentation: "article",
  marketplace: "unknown",
};

function clampSourceType(sourceType: string | undefined): string {
  const value = sourceType ?? "unknown";
  if (DB_SOURCE_TYPES.has(value)) return value;
  return SOURCE_TYPE_TO_DB[value] ?? "unknown";
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
    source_type: clampSourceType(candidate.sourceType),
    platform: candidate.platform ?? "other",
    adapter: candidate.adapter ?? "firecrawl",
    discovery_query: candidate.discoveryQuery ?? null,
    discovery_reason: candidate.discoveryReason ?? null,
    relevance_score: candidate.relevanceScore ?? 0,
    enrich_status: normalizeEnrichStatus(candidate.enrichStatus),
    account_type: candidate.accountType ?? null,
    engagement: (candidate.engagement ?? null) as Json,
    posted_at: candidate.postedAt ?? null,
    metadata: {
      ...((candidate.metadata ?? {}) as Record<string, Json>),
      // Preserve the fine-grained type the DB column can't hold.
      source_type_detail: candidate.sourceType ?? "unknown",
    } as Json,
    entity_key: primaryEntityKey({
      urls: [candidate.canonicalUrl ?? candidate.url, candidate.url],
      name: candidate.title ?? null,
    }),
  }));

  const { data, error } = await supabase.from("source_candidates").insert(rows).select("id");
  if (!error) return (data ?? []).map((row) => row.id);

  // A single bad row fails the whole batch insert. Retry row-by-row so one
  // constraint violation can't zero out an entire discovery run's evidence.
  const savedIds: string[] = [];
  let lastError = error.message;
  for (const row of rows) {
    const { data: single, error: singleError } = await supabase
      .from("source_candidates")
      .insert(row)
      .select("id")
      .single();
    if (singleError) {
      lastError = singleError.message;
      continue;
    }
    if (single) savedIds.push(single.id);
  }

  if (!savedIds.length) throw new Error(lastError);
  return savedIds;
}
