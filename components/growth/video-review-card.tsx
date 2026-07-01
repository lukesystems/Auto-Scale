import type { ProductionWorkspaceVideo } from "./production-workspace-types";
import { SceneRenderTimeline } from "./scene-render-timeline";
import { CaptionVariantsPanel } from "./caption-variants-panel";
import { VideoReviewActions } from "./video-review-actions";

export function VideoReviewCard({
  projectId,
  runId,
  video,
}: {
  projectId: string;
  runId: string;
  video: ProductionWorkspaceVideo;
}) {
  const partialNote = video.job?.error?.includes("fal fallback") || video.job?.status === "partial";

  return (
    <article className="rounded-xl border bg-card overflow-hidden">
      <div className="border-b bg-muted/30 px-4 py-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold">{video.hook.slice(0, 80)}</p>
          <p className="text-xs text-muted-foreground">
            {video.productionMode ?? video.videoType} · {video.platform} · job{" "}
            {video.job?.status ?? "pending"}
            {video.job?.currentStage ? ` · ${video.job.currentStage}` : ""}
          </p>
        </div>
        <span
          className={`text-xs font-medium px-2 py-1 rounded ${
            video.status === "ready"
              ? "bg-green-500/15 text-green-700 dark:text-green-300"
              : video.status === "failed"
                ? "bg-red-500/15 text-red-700 dark:text-red-300"
                : partialNote
                  ? "bg-amber-500/15 text-amber-800 dark:text-amber-200"
                  : "bg-muted text-muted-foreground"
          }`}
        >
          {partialNote ? "partial" : video.status}
        </span>
      </div>

      {video.quality ? (
        <div className="mx-4 mt-4 rounded-lg border bg-background p-3 text-xs space-y-1">
          <div className="flex justify-between">
            <span className="font-semibold">Quality gate</span>
            <span className={video.quality.passed ? "text-green-600" : "text-amber-600"}>
              {video.quality.passed ? "PASS" : "BLOCKED"}
            </span>
          </div>
          <p>Score {(video.quality.overallScore * 100).toFixed(0)}%</p>
          {video.quality.blockReason ? (
            <p className="text-amber-700 dark:text-amber-300">{video.quality.blockReason}</p>
          ) : null}
        </div>
      ) : null}

      <div className="p-4 grid gap-4 lg:grid-cols-2">
        <SceneRenderTimeline scenes={video.scenes} />
        <div className="space-y-3">
          {video.finalAssetUrl ? (
            <video
              src={video.finalAssetUrl}
              controls
              className="w-full rounded border"
              preload="metadata"
            />
          ) : (
            <p className="text-xs text-muted-foreground">MP4 pending render.</p>
          )}
          <CaptionVariantsPanel captions={video.captions} />
        </div>
      </div>

      <VideoReviewActions projectId={projectId} runId={runId} video={video} />
    </article>
  );
}
