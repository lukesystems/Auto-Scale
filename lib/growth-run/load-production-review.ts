import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import {
  buildWorkspaceVideos,
  type BuildWorkspaceVideosInput,
} from "@/lib/growth-run/build-workspace-videos";
import { summarizeWorkspaceVideos } from "@/components/growth/production-workspace-types";
import type { ProductionWorkspaceVideo } from "@/components/growth/production-workspace-types";
import { isSilentVoiceoverAsset } from "@/lib/schedule-guard";
import { loadRunProductionContext } from "@/services/video-factory/load-run-production-context";
import type { RunProductionContext } from "@/services/video-factory/load-run-production-context";

type Client = SupabaseClient<Database>;

export interface ProductionReviewData {
  productionContext: RunProductionContext;
  workspaceVideos: ProductionWorkspaceVideo[];
  workspaceSummary: ReturnType<typeof summarizeWorkspaceVideos>;
  hasSilentVoiceover: boolean;
  videoCount: number;
  approvedVideoCount: number;
}

/** Load all tables needed for Stage 3 review UI on a growth run page. */
export async function loadProductionReview(
  client: Client,
  projectId: string,
  runId: string
): Promise<ProductionReviewData> {
  const productionContext = await loadRunProductionContext(runId, projectId);

  const { data: concepts } = await client
    .from("video_concepts")
    .select("id, video_type, production_mode, platform, target_length_seconds, hook, angle, status, demo_clip_url")
    .eq("growth_run_id", runId)
    .order("video_type");

  const conceptIds = (concepts ?? []).map((c) => c.id);

  const { data: videos } = await client
    .from("videos")
    .select(
      "id, concept_id, status, approval_status, duration_seconds, aspect_ratio, final_asset_id, created_at"
    )
    .eq("growth_run_id", runId)
    .order("created_at", { ascending: false });

  const videoIds = (videos ?? []).map((v) => v.id);

  const [{ data: storyboards }, { data: receipts }, { data: experiments }, { data: fingerprints }] =
    await Promise.all([
      conceptIds.length
        ? client.from("storyboards").select("id, concept_id, total_duration_seconds").in("concept_id", conceptIds)
        : Promise.resolve({ data: [] as Array<{ id: string; concept_id: string; total_duration_seconds: number }> }),
      client
        .from("trend_receipts")
        .select(
          "id, concept_id, format_fingerprint_id, evidence_video_ids, source_pattern_ids, observed_evidence, strategic_inference, missing_evidence, expected_signal, confidence, reasoning"
        )
        .eq("growth_run_id", runId),
      client
        .from("controlled_experiments")
        .select(
          "id, format_fingerprint_id, tested_variable, audience_pain, fixed_body, fixed_cta, fixed_audience, evaluation_window_days, status, starts_at, ends_at"
        )
        .eq("growth_run_id", runId),
      client
        .from("format_fingerprints")
        .select(
          "id, name, video_type, platform, hook_mechanism, visual_grammar, script_structure, cta_pattern, business_hypothesis, transferability_score, distortion_risk, confidence, missing_evidence, evidence_video_ids, source_pattern_ids, status"
        )
        .eq("growth_run_id", runId)
        .order("confidence", { ascending: false }),
    ]);

  const storyboardIds = (storyboards ?? []).map((s) => s.id);

  const [
    { data: sceneRows },
    { data: jobs },
    { data: assets },
    { data: qualityRows },
    { data: captions },
    { data: accounts },
  ] = await Promise.all([
    storyboardIds.length
      ? client
          .from("storyboard_scenes")
          .select(
            "id, storyboard_id, scene_index, purpose, role, visual_method, overlay_text, voiceover_line, duration_seconds, status, error, metadata"
          )
          .in("storyboard_id", storyboardIds)
          .order("scene_index")
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    videoIds.length
      ? client
          .from("video_production_jobs")
          .select("id, video_id, concept_id, status, current_stage, error, platform_profile, production_mode")
          .in("video_id", videoIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    client
      .from("generated_assets")
      .select("id, concept_id, scene_id, kind, status, public_url, error, provider, metadata")
      .eq("growth_run_id", runId),
    videoIds.length
      ? client
          .from("video_quality_scores")
          .select(
            "video_id, overall_score, block_reason, hook_strength, cta_strength, duplicate_risk, claim_risk, pass_reasons"
          )
          .in("video_id", videoIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    videoIds.length
      ? client
          .from("video_captions")
          .select("id, video_id, platform, caption, connected_account_id")
          .in("video_id", videoIds)
      : Promise.resolve({ data: [] as Array<Record<string, unknown>> }),
    client.from("connected_accounts").select("id, handle").eq("project_id", projectId),
  ]);

  const conceptsById = new Map((concepts ?? []).map((c) => [c.id, c]));
  const boardByConcept = new Map((storyboards ?? []).map((b) => [b.concept_id, b]));
  const jobByVideo = new Map((jobs ?? []).map((j) => [j.video_id as string, j]));
  const qualityByVideo = new Map((qualityRows ?? []).map((q) => [q.video_id as string, q]));
  const assetsByConcept = new Map<string, NonNullable<typeof assets>>();
  for (const a of assets ?? []) {
    const cid = a.concept_id as string;
    if (!cid) continue;
    const list = assetsByConcept.get(cid) ?? [];
    list.push(a);
    assetsByConcept.set(cid, list);
  }
  const accountById = new Map((accounts ?? []).map((a) => [a.id, a.handle]));
  const captionsByVideo = new Map<
    string,
    Array<{ id: string; platform: string; caption: string; handle: string | null }>
  >();
  for (const c of captions ?? []) {
    const vid = c.video_id as string;
    const list = captionsByVideo.get(vid) ?? [];
    list.push({
      id: c.id as string,
      platform: c.platform as string,
      caption: c.caption as string,
      handle: c.connected_account_id ? (accountById.get(c.connected_account_id as string) ?? null) : null,
    });
    captionsByVideo.set(vid, list);
  }
  const receiptByConcept = new Map((receipts ?? []).map((r) => [r.concept_id, r]));
  const expByFingerprint = new Map((experiments ?? []).map((e) => [e.format_fingerprint_id, e]));
  const fpById = new Map((fingerprints ?? []).map((f) => [f.id, f]));

  const workspaceVideos = buildWorkspaceVideos({
    videos: videos ?? [],
    conceptsById,
    boardByConcept,
    sceneRows: sceneRows ?? [],
    jobByVideo,
    qualityByVideo,
    assets: assets ?? [],
    assetsByConcept,
    captionsByVideo,
    receiptByConcept,
    expByFingerprint,
    fpById,
  } as BuildWorkspaceVideosInput);

  const workspaceSummary = summarizeWorkspaceVideos(workspaceVideos);
  const hasSilentVoiceover = (assets ?? []).some(
    (a) =>
      a.kind === "voiceover" &&
      isSilentVoiceoverAsset({ metadata: (a.metadata as Record<string, unknown> | null) ?? null })
  );

  const approvedVideoCount = (videos ?? []).filter(
    (v) => v.approval_status === "approved" || v.approval_status === "auto_approved"
  ).length;

  return {
    productionContext,
    workspaceVideos,
    workspaceSummary,
    hasSilentVoiceover,
    videoCount: videos?.length ?? 0,
    approvedVideoCount,
  };
}
