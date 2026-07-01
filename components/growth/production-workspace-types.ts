/** Shared view model for Stage 3 production review UI. */
export interface ProductionWorkspaceVideo {
  id: string;
  conceptId: string;
  status: string;
  approvalStatus: string;
  durationSeconds: number | null;
  finalAssetUrl: string | null;
  hook: string;
  platform: string;
  videoType: string;
  productionMode: string | null;
  job: {
    id: string;
    status: string;
    currentStage: string | null;
    error: string | null;
    platformProfile: string;
  } | null;
  experiment: {
    testedVariable: string;
    audiencePain: string;
    fixedBody: string;
    fixedCta: string;
    fixedAudience: string;
    status: string;
  } | null;
  fingerprint: { name: string; status: string } | null;
  receipt: {
    observedEvidence: string[];
    strategicInference: string[];
    expectedSignal: string;
    confidence: number;
    missingEvidence: string[];
    hasEvidence: boolean;
    reasoning: string;
  } | null;
  quality: {
    overallScore: number;
    blockReason: string | null;
    hookStrength: number;
    ctaStrength: number;
    duplicateRisk: number;
    claimRisk: number;
    passReasons: string[];
    passed: boolean;
  } | null;
  scenes: Array<{
    id: string;
    sceneIndex: number;
    purpose: string | null;
    role: string;
    visualMethod: string | null;
    overlayText: string | null;
    voiceoverLine: string | null;
    durationSeconds: number;
    status: string;
    error: string | null;
    metadata?: Record<string, unknown> | null;
  }>;
  assets: Array<{
    id: string;
    kind: string;
    status: string;
    publicUrl: string | null;
    sceneId: string | null;
    error: string | null;
    provider: string | null;
    metadata: Record<string, unknown> | null;
  }>;
  captions: Array<{ id: string; platform: string; caption: string; handle: string | null }>;
}

export function isVideoApproved(video: ProductionWorkspaceVideo): boolean {
  return video.approvalStatus === "approved" || video.approvalStatus === "auto_approved";
}

export function summarizeWorkspaceVideos(videos: ProductionWorkspaceVideo[]) {
  return {
    total: videos.length,
    approved: videos.filter(isVideoApproved).length,
    ready: videos.filter((v) => v.status === "ready").length,
  };
}
