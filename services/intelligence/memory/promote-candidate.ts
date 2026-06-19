import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { AccountType, SourcePlatform } from "@/lib/supabase/types";
import { enrichSourceFromUrl, scoreSourceRecord, type SourceRecord } from "@/services/trendwatch/enrich-sources";
import { classifySource } from "@/services/trendwatch/classify-source";
import { detectPlatform } from "@/services/trendwatch/ingestion";

export async function promoteCandidateToSource(input: {
  projectId: string;
  candidateId: string;
}): Promise<{ sourceId: string }> {
  const supabase = createSupabaseServerClient();

  const { data: candidate, error: candidateError } = await supabase
    .from("source_candidates")
    .select("*")
    .eq("id", input.candidateId)
    .eq("project_id", input.projectId)
    .maybeSingle();

  if (candidateError || !candidate) {
    throw new Error(candidateError?.message ?? "Source candidate not found.");
  }

  if (candidate.review_status === "accepted") {
    throw new Error("Candidate already accepted.");
  }

  const platform = (candidate.platform || detectPlatform(candidate.url)) as SourcePlatform;
  const notes = [
    candidate.discovery_reason,
    candidate.discovery_query ? `Query: ${candidate.discovery_query}` : null,
    candidate.snippet,
  ]
    .filter(Boolean)
    .join("\n\n");

  const { data: inserted, error: insertError } = await supabase
    .from("trendwatch_sources")
    .insert({
      project_id: input.projectId,
      source_url: candidate.url,
      platform,
      account_handle: extractHandleFromMetadata(candidate.metadata),
      account_type: inferAccountType(candidate.source_type) as AccountType,
      caption: candidate.snippet,
      notes: notes || null,
      fetch_status: "pending",
    })
    .select("id, source_url, platform, account_handle, account_type, caption, published_at, follower_count, views, likes, saves, shares, comments, transferability_score, notes")
    .single();

  if (insertError || !inserted) {
    throw new Error(insertError?.message ?? "Failed to promote candidate.");
  }

  const patch = await enrichSourceFromUrl(inserted as SourceRecord);
  const classifiedSource = { ...inserted, fetched_text: patch.fetched_text } as SourceRecord;
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

  await supabase
    .from("source_candidates")
    .update({ review_status: "accepted", enrich_status: candidate.enrich_status === "pending" ? "enriched" : candidate.enrich_status })
    .eq("id", input.candidateId);

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
