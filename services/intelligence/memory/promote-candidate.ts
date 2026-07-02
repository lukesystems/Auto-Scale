import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database, AccountType, SourcePlatform } from "@/lib/supabase/types";
import type { SupabaseClient } from "@supabase/supabase-js";
import { enrichSourceFromUrl, scoreSourceRecord, type SourceRecord } from "@/services/trendwatch/enrich-sources";
import { classifySource } from "@/services/trendwatch/classify-source";
import { detectPlatform } from "@/services/trendwatch/ingestion";
import { TRENDWATCH_SOURCE_ENRICH_SELECT } from "@/lib/trendwatch/source-select";

type SupabaseClientType = SupabaseClient<Database>;

export async function promoteCandidateToSource(input: {
  projectId: string;
  candidateId: string;
  client?: SupabaseClientType;
  /** Skip fetch/classify during bulk discovery — enrich loop handles pending rows. */
  deferEnrichment?: boolean;
}): Promise<{ sourceId: string }> {
  const supabase = input.client ?? createSupabaseServerClient();

  const { data: candidate, error: candidateError } = await supabase
    .from("source_candidates")
    .select("*")
    .eq("id", input.candidateId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (candidateError || !candidate) {
    throw new Error(candidateError?.message ?? "Source candidate not found.");
  }

  if (candidate.review_status !== "pending") {
    throw new Error("Candidate is no longer pending review.");
  }

  const { data: existing } = await supabase
    .from("trendwatch_sources")
    .select("id")
    .eq("project_id", input.projectId)
    .eq("source_url", candidate.url)
    .maybeSingle();

  if (existing) {
    await supabase
      .from("source_candidates")
      .update({ review_status: "accepted" })
      .eq("id", input.candidateId)
      .eq("review_status", "pending");

    return { sourceId: existing.id };
  }

  const { data: claimed, error: claimError } = await supabase
    .from("source_candidates")
    .update({
      review_status: "accepted",
      enrich_status: candidate.enrich_status === "pending" ? "enriched" : candidate.enrich_status,
    })
    .eq("id", input.candidateId)
    .eq("review_status", "pending")
    .select("id")
    .maybeSingle();

  if (claimError || !claimed) {
    throw new Error("Candidate is no longer pending review.");
  }

  const platform = (candidate.platform || detectPlatform(candidate.url)) as SourcePlatform;
  const discoveryNotes = [
    candidate.discovery_reason,
    candidate.discovery_query ? `Query: ${candidate.discovery_query}` : null,
    candidate.snippet,
  ]
    .filter(Boolean)
    .join("\n\n");

  const insertPayload: Database["public"]["Tables"]["trendwatch_sources"]["Insert"] = {
    project_id: input.projectId,
    source_url: candidate.url,
    platform,
    account_handle: extractHandleFromMetadata(candidate.metadata),
    account_type: inferAccountType(candidate.source_type) as AccountType,
    notes: discoveryNotes || null,
    fetch_status: "pending",
  };

  const { data: inserted, error: insertError } = await supabase
    .from("trendwatch_sources")
    .insert(insertPayload)
    .select("id")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Failed to promote candidate.");
  }

  // #region agent log
  fetch("http://127.0.0.1:7755/ingest/e9fc8964-ae23-4fa9-a7cb-b5541b636a4d", {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "845232" },
    body: JSON.stringify({
      sessionId: "845232",
      hypothesisId: "H-caption",
      location: "promote-candidate.ts:insert",
      message: "candidate promoted to trendwatch_sources",
      data: { sourceId: inserted.id, deferEnrichment: Boolean(input.deferEnrichment) },
      timestamp: Date.now(),
    }),
  }).catch(() => {});
  // #endregion

  if (input.deferEnrichment) {
    return { sourceId: inserted.id };
  }

  const { data: sourceRow, error: loadError } = await supabase
    .from("trendwatch_sources")
    .select(TRENDWATCH_SOURCE_ENRICH_SELECT)
    .eq("id", inserted.id)
    .single();

  if (loadError || !sourceRow) {
    return { sourceId: inserted.id };
  }

  const patch = await enrichSourceFromUrl(sourceRow as SourceRecord);
  const classifiedSource = { ...sourceRow, fetched_text: patch.fetched_text } as SourceRecord;
  const classification = await classifySource(classifiedSource);
  const rescored = scoreSourceRecord(
    { ...classifiedSource, transferability_score: classification.transferability_score },
    patch.fetch_status === "success",
    typeof patch.fetch_metadata.error === "string" ? patch.fetch_metadata.error : null
  );

  await supabase
    .from("trendwatch_sources")
    .update({
      fetch_status: patch.fetch_status,
      fetched_text: patch.fetched_text,
      fetch_metadata: patch.fetch_metadata as never,
      signal_score: rescored.score.signalScore,
      confidence_score: rescored.score.confidenceScore,
      scoring_reasons: rescored.score.reasons as never,
      distortion_risk: classification.distortion_risk,
      transferability_score: classification.transferability_score,
      account_type: classification.account_type,
      format: classification.format,
      hook: classification.hook,
      angle: classification.angle,
      visual_pattern: classification.visual_pattern,
      cta_pattern: classification.cta_pattern,
      audience_pain: classification.audience_pain,
      why_it_worked: classification.why_it_worked,
      how_to_adapt: classification.how_to_adapt,
      platform: (patch.platform as SourcePlatform) ?? platform,
    })
    .eq("id", inserted.id);

  return { sourceId: inserted.id };
}

function extractHandleFromMetadata(metadata: unknown): string | null {
  if (!metadata || typeof metadata !== "object") return null;
  const handle = (metadata as { account_handle?: unknown }).account_handle;
  return typeof handle === "string" ? handle : null;
}

function inferAccountType(sourceType: string): SourceRecord["account_type"] {
  if (sourceType === "competitor") return "competitor";
  if (sourceType === "creator") return "creator";
  if (sourceType === "review") return "review";
  return "unknown";
}
