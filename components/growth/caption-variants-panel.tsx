import type { ProductionWorkspaceVideo } from "./production-workspace";

export function CaptionVariantsPanel({
  captions,
}: {
  captions: ProductionWorkspaceVideo["captions"];
}) {
  if (!captions.length) {
    return (
      <div className="rounded-lg border bg-background p-3 text-xs text-muted-foreground">
        Per-account captions generate after render when connected accounts exist.
      </div>
    );
  }
  return (
    <div className="rounded-lg border bg-background p-3 space-y-2">
      <h3 className="font-semibold text-sm">Caption variants</h3>
      <ul className="space-y-2 text-xs">
        {captions.map((c) => (
          <li key={c.id} className="rounded border p-2">
            <p className="font-medium">
              {c.platform}
              {c.handle ? ` · @${c.handle}` : ""}
            </p>
            <p className="text-muted-foreground mt-1 line-clamp-3">{c.caption}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
