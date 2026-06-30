import type { ProductionWorkspaceVideo } from "./production-workspace";
import { scoreHook } from "@/services/video-factory/pre-render-gate";

export function RenderQueuePanel({
  videos,
}: {
  videos: ProductionWorkspaceVideo[];
}) {
  if (!videos.length) return null;
  return (
    <div className="rounded-lg border bg-card p-4 space-y-2">
      <h3 className="text-sm font-semibold">Render progress</h3>
      <p className="text-xs text-muted-foreground">
        Concepts ordered by hook score. Stage 3 only advances when every video reaches ready.
      </p>
      <ol className="space-y-1 text-xs">
        {[...videos]
          .sort((a, b) => scoreHook(b.hook) - scoreHook(a.hook))
          .map((v) => (
            <li key={v.id} className="flex justify-between gap-2 rounded border px-2 py-1.5">
              <span className="truncate">{v.hook.slice(0, 60)}</span>
              <span className="shrink-0 text-muted-foreground">
                hook {scoreHook(v.hook).toFixed(1)} · {v.job?.status ?? v.status}
              </span>
            </li>
          ))}
      </ol>
    </div>
  );
}
