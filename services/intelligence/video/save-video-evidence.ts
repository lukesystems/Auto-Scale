import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Json } from "@/lib/supabase/types";
import { findMatchingCompetitor, type CompetitorIdentity } from "../entity-resolution/match-competitor";
import { scoreVideoEvidence } from "./score-video-evidence";
import { VideoEvidenceSchema, type VideoEvidence } from "./schema";

export function toVideoEvidenceRow(evidence: VideoEvidence) {
  return {
    project_id: evidence.projectId!,
    competitor_id: evidence.competitorId,
    source_candidate_id: evidence.sourceCandidateId,
    platform: evidence.platform,
    video_url: evidence.videoUrl,
    canonical_url: evidence.canonicalUrl,
    account_handle: evidence.accountHandle,
    account_url: evidence.accountUrl,
    caption: evidence.caption,
    title: evidence.title,
    hashtags: evidence.hashtags as Json,
    sound: evidence.sound,
    duration_seconds: evidence.durationSeconds,
    view_count: evidence.viewCount,
    like_count: evidence.likeCount,
    comment_count: evidence.commentCount,
    share_count: evidence.shareCount,
    posted_at: evidence.postedAt,
    linked_urls: evidence.linkedUrls as Json,
    detected_hook: evidence.detectedHook,
    detected_cta: evidence.detectedCTA,
    format_guess: evidence.formatGuess,
    topic_guess: evidence.topicGuess,
    source_confidence: evidence.sourceConfidence,
    fetch_status: evidence.fetchStatus,
    fetch_method: evidence.fetchMethod,
    raw_source_type: evidence.rawSourceType,
    metadata: {
      ...evidence.metadata,
      ...(evidence.followerCount != null ? { follower_count: evidence.followerCount } : {}),
      ...(evidence.accountType !== "unknown" ? { account_type: evidence.accountType } : {}),
    } as Json,
  };
}

export async function saveVideoEvidence(input: {
  evidence: VideoEvidence;
  projectId: string;
  sourceCandidateId?: string | null;
  briefKeywords?: string[];
}): Promise<VideoEvidence> {
  const supabase = createSupabaseServerClient();
  let competitorId = input.evidence.competitorId;

  if (!competitorId && input.sourceCandidateId) {
    const { data: candidate } = await supabase
      .from("source_candidates")
      .select("competitor_id")
      .eq("id", input.sourceCandidateId)
      .eq("project_id", input.projectId)
      .maybeSingle();
    competitorId = candidate?.competitor_id ?? null;
  }

  if (!competitorId) competitorId = await resolveCompetitorId(input.projectId, input.evidence);

  const enriched = VideoEvidenceSchema.parse({
    ...input.evidence,
    projectId: input.projectId,
    sourceCandidateId: input.sourceCandidateId ?? input.evidence.sourceCandidateId,
    competitorId,
  });
  const scored = scoreVideoEvidence(enriched, input.briefKeywords);
  const finalEvidence = VideoEvidenceSchema.parse({
    ...enriched,
    sourceConfidence: scored.score,
    metadata: { ...enriched.metadata, score_reasons: scored.reasons },
  });

  const { data, error } = await supabase
    .from("video_evidence")
    .upsert(toVideoEvidenceRow(finalEvidence), { onConflict: "project_id,canonical_url" })
    .select("id")
    .single();
  if (error || !data) throw new Error(error?.message ?? "Failed to save video evidence.");

  if ([finalEvidence.viewCount, finalEvidence.likeCount, finalEvidence.commentCount, finalEvidence.shareCount].some((value) => value != null)) {
    const { error: snapshotError } = await supabase.from("video_metrics_snapshots").insert({
      video_evidence_id: data.id,
      view_count: finalEvidence.viewCount,
      like_count: finalEvidence.likeCount,
      comment_count: finalEvidence.commentCount,
      share_count: finalEvidence.shareCount,
    });
    if (snapshotError) throw new Error(snapshotError.message);
  }

  return finalEvidence;
}

async function resolveCompetitorId(projectId: string, evidence: VideoEvidence): Promise<string | null> {
  const supabase = createSupabaseServerClient();
  const [{ data: competitors }, { data: accounts }] = await Promise.all([
    supabase.from("competitors").select("id, name, url, entity_key, evidence_urls").eq("project_id", projectId),
    supabase.from("competitor_accounts").select("competitor_id, url").eq("project_id", projectId),
  ]);

  const accountUrls = new Map<string, string[]>();
  for (const account of accounts ?? []) {
    if (!account.competitor_id || !account.url) continue;
    accountUrls.set(account.competitor_id, [...(accountUrls.get(account.competitor_id) ?? []), account.url]);
  }
  const identities: CompetitorIdentity[] = (competitors ?? []).map((competitor) => ({
    id: competitor.id,
    name: competitor.name,
    entityKey: competitor.entity_key,
    evidenceUrls: [
      competitor.url,
      ...(Array.isArray(competitor.evidence_urls) ? competitor.evidence_urls.filter((value): value is string => typeof value === "string") : []),
      ...(accountUrls.get(competitor.id) ?? []),
    ].filter((value): value is string => Boolean(value)),
  }));

  return findMatchingCompetitor(
    { urls: [evidence.videoUrl, evidence.canonicalUrl, evidence.accountUrl, ...evidence.linkedUrls] },
    identities
  )?.id ?? null;
}
