import type { ProductionWorkspaceVideo } from "@/components/growth/production-workspace-types";

interface ConceptRow {
  hook?: string | null;
  platform?: string | null;
  video_type?: string | null;
  production_mode?: string | null;
}

interface StoryboardRow {
  id: string;
  concept_id: string;
}

interface SceneRow {
  id: string;
  storyboard_id: string;
  scene_index: number;
  purpose?: string | null;
  role: string;
  visual_method?: string | null;
  overlay_text?: string | null;
  voiceover_line?: string | null;
  duration_seconds: number;
  status: string;
  error?: string | null;
  metadata?: unknown;
}

interface JobRow {
  id: string;
  video_id: string;
  status: string;
  current_stage?: string | null;
  error?: string | null;
  platform_profile: string;
}

interface QualityRow {
  video_id: string;
  overall_score: number;
  block_reason?: string | null;
  hook_strength: number;
  cta_strength: number;
  duplicate_risk: number;
  claim_risk: number;
  pass_reasons?: unknown;
}

interface AssetRow {
  id: string;
  concept_id?: string | null;
  kind: string;
  status: string;
  public_url?: string | null;
  scene_id?: string | null;
  error?: string | null;
  provider?: string | null;
  metadata?: unknown;
}

interface ReceiptRow {
  concept_id: string;
  format_fingerprint_id?: string | null;
  observed_evidence?: unknown;
  strategic_inference?: unknown;
  missing_evidence?: unknown;
  evidence_video_ids?: unknown;
  expected_signal?: string | null;
  confidence?: number | null;
  reasoning?: string | null;
}

interface ExperimentRow {
  format_fingerprint_id: string;
  tested_variable: string;
  audience_pain: string;
  fixed_body: string;
  fixed_cta: string;
  fixed_audience: string;
  status: string;
}

interface FingerprintRow {
  id: string;
  name: string;
  status: string;
}

interface CaptionView {
  id: string;
  platform: string;
  caption: string;
  handle: string | null;
}

export interface BuildWorkspaceVideosInput {
  videos: Array<{
    id: string;
    concept_id: string | null;
    status: string;
    approval_status: string;
    duration_seconds: number | null;
    final_asset_id: string | null;
  }>;
  conceptsById: Map<string, ConceptRow>;
  boardByConcept: Map<string, StoryboardRow>;
  sceneRows: SceneRow[];
  jobByVideo: Map<string, JobRow>;
  qualityByVideo: Map<string, QualityRow>;
  assets: AssetRow[];
  assetsByConcept: Map<string, AssetRow[]>;
  captionsByVideo: Map<string, CaptionView[]>;
  receiptByConcept: Map<string, ReceiptRow>;
  expByFingerprint: Map<string, ExperimentRow>;
  fpById: Map<string, FingerprintRow>;
}

export function buildWorkspaceVideos(input: BuildWorkspaceVideosInput): ProductionWorkspaceVideo[] {
  const {
    videos,
    conceptsById,
    boardByConcept,
    sceneRows,
    jobByVideo,
    qualityByVideo,
    assets,
    assetsByConcept,
    captionsByVideo,
    receiptByConcept,
    expByFingerprint,
    fpById,
  } = input;

  return videos.map((v) => {
    const concept = v.concept_id ? conceptsById.get(v.concept_id) : null;
    const board = v.concept_id ? boardByConcept.get(v.concept_id) : undefined;
    const scenes = board
      ? sceneRows
          .filter((s) => s.storyboard_id === board.id)
          .map((s) => ({
            id: s.id,
            sceneIndex: s.scene_index,
            purpose: s.purpose ?? null,
            role: s.role,
            visualMethod: s.visual_method ?? null,
            overlayText: s.overlay_text ?? null,
            voiceoverLine: s.voiceover_line ?? null,
            durationSeconds: s.duration_seconds,
            status: s.status,
            error: s.error ?? null,
            metadata:
              s.metadata && typeof s.metadata === "object" && !Array.isArray(s.metadata)
                ? (s.metadata as Record<string, unknown>)
                : null,
          }))
      : [];
    const jobRow = jobByVideo.get(v.id);
    const receipt = v.concept_id ? receiptByConcept.get(v.concept_id) : undefined;
    const fp = receipt?.format_fingerprint_id ? fpById.get(receipt.format_fingerprint_id) : undefined;
    const exp = receipt?.format_fingerprint_id
      ? expByFingerprint.get(receipt.format_fingerprint_id)
      : undefined;
    const quality = qualityByVideo.get(v.id);
    const finalAsset = assets.find((a) => a.id === v.final_asset_id);
    const observed = Array.isArray(receipt?.observed_evidence)
      ? (receipt!.observed_evidence as string[])
      : [];
    const inference = Array.isArray(receipt?.strategic_inference)
      ? (receipt!.strategic_inference as string[])
      : [];
    const missing = Array.isArray(receipt?.missing_evidence)
      ? (receipt!.missing_evidence as string[])
      : [];
    const hasEvidence =
      observed.length > 0 ||
      (Array.isArray(receipt?.evidence_video_ids) &&
        (receipt!.evidence_video_ids as string[]).length > 0);

    return {
      id: v.id,
      conceptId: v.concept_id ?? "",
      status: v.status,
      approvalStatus: v.approval_status,
      durationSeconds: v.duration_seconds,
      finalAssetUrl: finalAsset?.public_url ?? null,
      hook: concept?.hook ?? "",
      platform: concept?.platform ?? "tiktok",
      videoType: concept?.video_type ?? "slide",
      productionMode: concept?.production_mode ?? null,
      job: jobRow
        ? {
            id: jobRow.id,
            status: jobRow.status,
            currentStage: jobRow.current_stage ?? null,
            error: jobRow.error ?? null,
            platformProfile: jobRow.platform_profile,
          }
        : null,
      experiment: exp
        ? {
            testedVariable: exp.tested_variable,
            audiencePain: exp.audience_pain,
            fixedBody: exp.fixed_body,
            fixedCta: exp.fixed_cta,
            fixedAudience: exp.fixed_audience,
            status: exp.status,
          }
        : null,
      fingerprint: fp ? { name: fp.name, status: fp.status } : null,
      receipt: receipt
        ? {
            observedEvidence: observed,
            strategicInference: inference,
            expectedSignal: receipt.expected_signal ?? "",
            confidence: receipt.confidence ?? 0,
            missingEvidence: missing,
            hasEvidence,
            reasoning: receipt.reasoning ?? "",
          }
        : null,
      quality: quality
        ? {
            overallScore: quality.overall_score,
            blockReason: quality.block_reason ?? null,
            hookStrength: quality.hook_strength,
            ctaStrength: quality.cta_strength,
            duplicateRisk: quality.duplicate_risk,
            claimRisk: quality.claim_risk,
            passReasons: Array.isArray(quality.pass_reasons)
              ? (quality.pass_reasons as string[])
              : [],
            passed: quality.overall_score >= 0.55 && !quality.block_reason,
          }
        : null,
      scenes,
      assets: (v.concept_id ? assetsByConcept.get(v.concept_id) ?? [] : []).map((a) => ({
        id: a.id,
        kind: a.kind,
        status: a.status,
        publicUrl: a.public_url ?? null,
        sceneId: a.scene_id ?? null,
        error: a.error ?? null,
        provider: a.provider ?? null,
        metadata:
          a.metadata && typeof a.metadata === "object" && !Array.isArray(a.metadata)
            ? (a.metadata as Record<string, unknown>)
            : null,
      })),
      captions: captionsByVideo.get(v.id) ?? [],
    };
  });
}
