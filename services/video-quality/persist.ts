import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { scoreVideo, type VideoQualityScore } from "./score";

type Client = SupabaseClient<Database>;

export interface PersistQualityInput {
  client: Client;
  projectId: string;
  growthRunId: string;
  conceptId: string;
  videoId: string;
  score: VideoQualityScore;
}

export async function persistVideoQualityScore(input: PersistQualityInput): Promise<void> {
  const { error } = await input.client.from("video_quality_scores").upsert(
    {
      project_id: input.projectId,
      growth_run_id: input.growthRunId,
      concept_id: input.conceptId,
      video_id: input.videoId,
      hook_strength: input.score.hook_strength,
      clarity: input.score.clarity,
      pacing: input.score.pacing,
      text_density: input.score.text_density,
      cta_strength: input.score.cta_strength,
      platform_fit: input.score.platform_fit,
      brand_safety: input.score.brand_safety,
      duplicate_risk: input.score.duplicate_risk,
      claim_risk: input.score.claim_risk,
      overall_score: input.score.overall_score,
      block_reason: input.score.block_reason,
      pass_reasons: input.score.pass_reasons as never,
    } as never,
    { onConflict: "video_id" }
  );
  if (error) throw new Error(`video_quality_scores upsert: ${error.message}`);
}

export async function loadVideoQualityScore(
  client: Client,
  videoId: string
): Promise<VideoQualityScore | null> {
  const { data } = await client
    .from("video_quality_scores")
    .select("*")
    .eq("video_id", videoId)
    .maybeSingle();
  if (!data) return null;
  return {
    hook_strength: Number(data.hook_strength),
    clarity: Number(data.clarity),
    pacing: Number(data.pacing),
    text_density: Number(data.text_density),
    cta_strength: Number(data.cta_strength),
    platform_fit: Number(data.platform_fit),
    brand_safety: Number(data.brand_safety),
    duplicate_risk: Number(data.duplicate_risk),
    claim_risk: Number(data.claim_risk),
    final_asset_exists: Number((data as { final_asset_exists?: number }).final_asset_exists ?? 1),
    overall_score: Number(data.overall_score),
    block_reason: data.block_reason,
    pass_reasons: Array.isArray(data.pass_reasons)
      ? (data.pass_reasons as string[])
      : [],
  };
}
