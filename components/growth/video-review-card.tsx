import Link from "next/link";
import {
  decideVideoAction,
  rerenderVideoAction,
  reviseHookAction,
  reviseSceneTextAction,
  regenerateSceneVisualAction,
  regenerateVoiceoverFormAction,
} from "@/app/(app)/projects/[id]/growth/actions";
import type { ProductionWorkspaceVideo } from "./production-workspace";
import { SceneRenderTimeline } from "./scene-render-timeline";
import { CaptionVariantsPanel } from "./caption-variants-panel";

export function VideoReviewCard({
  projectId,
  runId,
  video,
}: {
  projectId: string;
  runId: string;
  video: ProductionWorkspaceVideo;
}) {
  const hookScene = video.scenes.find((s) => s.purpose === "hook" || s.role === "hook");
  const voice = video.assets.find((a) => a.kind === "voiceover");
  const voiceSilent = voice?.metadata?.is_silent === true;
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

      <div className="border-t bg-muted/20 px-4 py-3 flex flex-wrap gap-2 items-end">
        <form action={decideVideoAction} className="inline-flex flex-wrap items-center gap-2">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <input type="hidden" name="videoId" value={video.id} />
          <input type="hidden" name="decision" value="approve" />
          {voiceSilent ? (
            <label className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300">
              <input type="checkbox" name="confirmSilentOverride" />
              Approve silent voiceover anyway
            </label>
          ) : null}
          <button type="submit" className="rounded border border-green-600/40 px-2 py-1 text-xs hover:bg-muted">
            Approve
          </button>
        </form>
        <form action={decideVideoAction} className="inline">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <input type="hidden" name="videoId" value={video.id} />
          <input type="hidden" name="decision" value="reject" />
          <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
            Reject
          </button>
        </form>
        <form action={rerenderVideoAction} className="inline">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <input type="hidden" name="videoId" value={video.id} />
          <input type="hidden" name="conceptId" value={video.conceptId} />
          <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
            Re-render
          </button>
        </form>
        {video.finalAssetUrl ? (
          <form action={regenerateVoiceoverFormAction} className="inline">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="growthRunId" value={runId} />
            <input type="hidden" name="videoId" value={video.id} />
            <input type="hidden" name="conceptId" value={video.conceptId} />
            <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
              Re-synthesize VO
            </button>
          </form>
        ) : null}
        {hookScene ? (
          <form action={reviseSceneTextAction} className="inline-flex gap-1 items-center">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="growthRunId" value={runId} />
            <input type="hidden" name="sceneId" value={hookScene.id} />
            <input
              name="overlayText"
              placeholder="Edit hook overlay"
              className="rounded border px-2 py-1 text-xs w-40"
              defaultValue={hookScene.overlayText ?? ""}
            />
            <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
              Save scene
            </button>
          </form>
        ) : null}
        {hookScene ? (
          <form action={regenerateSceneVisualAction} className="inline">
            <input type="hidden" name="projectId" value={projectId} />
            <input type="hidden" name="growthRunId" value={runId} />
            <input type="hidden" name="videoId" value={video.id} />
            <input type="hidden" name="conceptId" value={video.conceptId} />
            <input type="hidden" name="sceneId" value={hookScene.id} />
            <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
              Regenerate scene
            </button>
          </form>
        ) : null}
        <form action={reviseHookAction} className="inline-flex gap-1 items-center">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <input type="hidden" name="videoId" value={video.id} />
          <input type="hidden" name="conceptId" value={video.conceptId} />
          <input name="newHook" placeholder="Revise hook" className="rounded border px-2 py-1 text-xs w-48" />
          <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
            Update hook
          </button>
        </form>
        <Link
          href={`/api/projects/${projectId}/growth/${runId}/export`}
          className="rounded border px-2 py-1 text-xs hover:bg-muted"
        >
          Export pack
        </Link>
      </div>
    </article>
  );
}
