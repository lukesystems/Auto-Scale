import {
  AUDIO_MODE_SPECS,
  PRODUCTION_FORMAT_SPECS,
  type AudioMode,
  type FalModelTier,
  type ProductionFormat,
} from "@/services/video-factory/production-options";
import { describeFalTierForRun } from "@/services/video-factory/fal/model-router";
import { ProductionProviderBar, type ProductionProviderStatus } from "./production-provider-bar";
import { RenderQueuePanel } from "./render-queue-panel";
import { VideoReviewCard } from "./video-review-card";
import type { ProductionWorkspaceVideo } from "./production-workspace";

interface ProductionCommandCenterProps {
  projectId: string;
  runId: string;
  videos: ProductionWorkspaceVideo[];
  productionFormat?: ProductionFormat;
  audioMode?: AudioMode;
  falRenderMode?: "cinematic" | "fast";
  falModelTier?: FalModelTier;
  providerStatus: ProductionProviderStatus;
  approvedCount?: number;
  totalCount?: number;
}

export function ProductionCommandCenter({
  projectId,
  runId,
  videos,
  productionFormat,
  audioMode,
  falRenderMode = "fast",
  falModelTier = "auto",
  providerStatus,
  approvedCount = 0,
  totalCount = 0,
}: ProductionCommandCenterProps) {
  if (!videos.length) {
    return (
      <section className="rounded-lg border bg-card p-6 text-sm text-muted-foreground space-y-3">
        <h2 className="text-lg font-semibold text-foreground">Production Command Center</h2>
        <p>Videos appear here once Stage 3 render starts. Configure format at the storyboards gate.</p>
        <ProductionProviderBar status={providerStatus} />
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-lg font-semibold">Production Command Center</h2>
            <p className="text-sm text-muted-foreground">
              Production plan → scene timeline → asset pipeline → per-video approve before Stage 4.
            </p>
          </div>
          {totalCount > 0 ? (
            <span className="text-xs font-medium rounded-full border px-2 py-1">
              {approvedCount}/{totalCount} approved
            </span>
          ) : null}
        </div>
        {(productionFormat || audioMode) && (
          <p className="text-xs text-muted-foreground">
            Run production:{" "}
            {productionFormat ? (
              <span className="font-medium text-foreground">
                {PRODUCTION_FORMAT_SPECS[productionFormat].label}
              </span>
            ) : null}
            {productionFormat && audioMode ? " · " : null}
            {audioMode ? (
              <span className="font-medium text-foreground">{AUDIO_MODE_SPECS[audioMode].label}</span>
            ) : null}
            {productionFormat || audioMode ? " · " : null}
            <span className="font-medium text-foreground">
              {describeFalTierForRun({ falRenderMode, falModelTier })}
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
