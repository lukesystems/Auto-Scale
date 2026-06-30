import type { ProductionWorkspaceVideo } from "./production-workspace";

const ORDER = ["hook", "problem", "mechanism", "demo", "proof", "cta", "outro"];

export function SceneRenderTimeline({
  scenes,
}: {
  scenes: ProductionWorkspaceVideo["scenes"];
}) {
  const sorted = [...scenes].sort(
    (a, b) =>
      (ORDER.indexOf(a.purpose ?? a.role) >= 0 ? ORDER.indexOf(a.purpose ?? a.role) : 99) -
      (ORDER.indexOf(b.purpose ?? b.role) >= 0 ? ORDER.indexOf(b.purpose ?? b.role) : 99)
  );

  return (
    <div className="rounded-lg border bg-background p-3">
      <h3 className="font-semibold text-sm mb-2">Scene timeline</h3>
      <ol className="space-y-1 text-xs">
        {sorted.map((s) => (
          <li
            key={s.id}
            className="grid grid-cols-[5rem_1fr_auto] gap-2 items-start border-l-2 border-primary/30 pl-2"
          >
            <span className="font-medium capitalize">{s.purpose ?? s.role}</span>
            <span className="text-muted-foreground truncate">
              {s.overlayText || s.voiceoverLine || "—"} · {s.visualMethod ?? "slide"}
              {s.error ? ` · ${s.error}` : ""}
            </span>
            <span className={s.status === "ready" ? "text-green-600" : "text-muted-foreground"}>
              {s.status}
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}
