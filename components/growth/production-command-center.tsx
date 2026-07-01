import { continueStage3ToScheduleAction } from "@/app/(app)/projects/[id]/growth/actions";
import {
  AUDIO_MODE_SPECS,
  VIDEO_OUTPUT_MODE_SPECS,
  describeVisualPipeline,
  type AudioMode,
  type CreativeFormat,
  type FalModelTier,
  type QualityTier,
  type VideoOutputMode,
  type VisualPipeline,
} from "@/services/video-factory/production-options";
import { describeFalTierForRun } from "@/services/video-factory/fal/model-router";
import { ProductionProviderBar, type ProductionProviderStatus } from "./production-provider-bar";
import { Stage3RerunButton } from "./stage3-rerun-button";
import { RenderQueuePanel } from "./render-queue-panel";
import { VideoReviewCard } from "./video-review-card";
import type { ProductionWorkspaceVideo } from "./production-workspace-types";

interface ProductionCommandCenterProps {
  projectId: string;
  runId: string;
  videos: ProductionWorkspaceVideo[];
  videoOutputMode?: VideoOutputMode;
  creativeFormat?: CreativeFormat;
  qualityTier?: QualityTier;
  audioMode?: AudioMode;
  falRenderMode?: "cinematic" | "fast";
  falModelTier?: FalModelTier;
  visualPipeline?: VisualPipeline | null;
  resolvedVisualPipeline?: VisualPipeline;
  providerStatus: ProductionProviderStatus;
  approvedCount?: number;
  readyCount?: number;
  totalCount?: number;
  canRerunStage3?: boolean;
}

export function ProductionCommandCenter({
  projectId,
  runId,
  videos,
  videoOutputMode,
  creativeFormat,
  qualityTier = "cinematic",
  audioMode,
  falRenderMode = "fast",
  falModelTier = "auto",
  visualPipeline = null,
  resolvedVisualPipeline,
  providerStatus,
  approvedCount = 0,
  readyCount = 0,
  totalCount = 0,
  canRerunStage3 = false,
}: ProductionCommandCenterProps) {
  if (!videos.length) {
    return (
      <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground space-y-3">
        <Stage3Banner
          projectId={projectId}
          growthRunId={runId}
          readyCount={readyCount}
          approvedCount={approvedCount}
          totalCount={totalCount}
        />
        <h2 className="text-lg font-semibold text-foreground">Production Command Center</h2>
        <p>Videos appear here once Stage 3 render starts. Configure format at the storyboards gate.</p>
        <ProductionProviderBar status={providerStatus} />
        {canRerunStage3 ? (
          <Stage3RerunButton projectId={projectId} growthRunId={runId} label="Rerun all videos" />
        ) : null}
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <Stage3Banner
        projectId={projectId}
        growthRunId={runId}
        readyCount={readyCount}
        approvedCount={approvedCount}
        totalCount={totalCount}
      />

      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Production Command Center</h2>
            <p className="text-sm text-muted-foreground">
              Scene timeline → preview → approve each video before scheduling.
            </p>
          </div>
          {totalCount > 0 ? (
            <span className="text-xs font-medium rounded-full border px-2 py-1">
              {approvedCount}/{totalCount} approved
            </span>
          ) : null}
          {canRerunStage3 ? (
            <Stage3RerunButton projectId={projectId} growthRunId={runId} label="Rerun all videos" />
          ) : null}
        </div>
        {(videoOutputMode || audioMode || creativeFormat) && (
          <p className="text-xs text-muted-foreground">
            Run production:{" "}
            {videoOutputMode ? (
              <span className="font-medium text-foreground">
                {VIDEO_OUTPUT_MODE_SPECS[videoOutputMode].label}
              </span>
            ) : null}
            {creativeFormat ? (
              <>
                {videoOutputMode ? " · " : null}
                <span className="font-medium text-foreground">
                  {creativeFormatLabel(creativeFormat)}
                </span>
              </>
            ) : null}
            {(videoOutputMode || creativeFormat) && audioMode ? " · " : null}
            {audioMode ? (
              <span className="font-medium text-foreground">{AUDIO_MODE_SPECS[audioMode].label}</span>
            ) : null}
            {videoOutputMode || creativeFormat || audioMode ? " · " : null}
            <span className="font-medium text-foreground">
              {describeFalTierForRun({ falRenderMode, falModelTier, qualityTier, videoOutputMode })}
            </span>
            {" · "}
            <span className="font-medium text-foreground">
              {describeVisualPipeline(visualPipeline, resolvedVisualPipeline)}
            </span>
          </p>
        )}
        <ProductionProviderBar status={providerStatus} />
      </header>

      <RenderQueuePanel videos={videos} />

      <div className="space-y-6">
        {videos.map((video) => (
          <VideoReviewCard key={video.id} projectId={projectId} runId={runId} video={video} />
        ))}
      </div>
    </section>
  );
}

function creativeFormatLabel(format: CreativeFormat): string {
  const labels: Record<CreativeFormat, string> = {
    pain_led: "Pain-led narrative",
    objection_handler: "Objection handler",
    comparison: "Comparison",
    demo_walkthrough: "Demo walkthrough",
    founder_story: "Founder story",
    proof_case_study: "Proof case study",
    feature_launch: "Feature launch",
  };
  return labels[format] ?? format;
}

function Stage3Banner({
  projectId,
  growthRunId,
  readyCount,
  approvedCount,
  totalCount,
}: {
  projectId: string;
  growthRunId: string;
  readyCount: number;
  approvedCount: number;
  totalCount: number;
}) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Stage 3 — Production</p>
        <p className="text-sm font-medium mt-1">
          {readyCount} ready · {approvedCount}/{totalCount} approved for schedule
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Review each video below. Approve per video before continuing to distribution.
        </p>
      </div>
      <form action={continueStage3ToScheduleAction} className="inline">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="growthRunId" value={growthRunId} />
        <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
          Continue to scheduling
        </button>
      </form>
    </div>
  );
}
