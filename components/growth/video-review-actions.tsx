import {
  decideVideoAction,
  rerenderVideoAction,
  reviseHookAction,
  reviseSceneTextAction,
  regenerateSceneVisualAction,
  regenerateVoiceoverFormAction,
} from "@/app/(app)/projects/[id]/growth/actions";
import type { ProductionWorkspaceVideo } from "./production-workspace-types";

export function VideoReviewActions({
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

  return (
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
    </div>
  );
}
