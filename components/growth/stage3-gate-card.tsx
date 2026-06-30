import { acknowledgeLowEvidenceAction } from "@/app/(app)/projects/[id]/growth/actions";

export function Stage3GateCard({
  projectId,
  growthRunId,
  videoCount,
  approvedVideoCount,
  readyVideoCount,
}: {
  projectId: string;
  growthRunId: string;
  videoCount: number;
  approvedVideoCount: number;
  readyVideoCount: number;
}) {
  return (
    <div className="rounded-xl border border-primary/30 bg-primary/[0.03] p-4 space-y-3">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wide text-primary">Stage 3 — Production</p>
        <p className="text-sm font-medium mt-1">
          {readyVideoCount} ready · {approvedVideoCount}/{videoCount} approved for schedule
        </p>
        <p className="text-xs text-muted-foreground mt-1">
          Review each video in the Production Command Center. Approve per video before continuing to
          distribution.
        </p>
      </div>
      <form action={acknowledgeLowEvidenceAction} className="inline">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="growthRunId" value={growthRunId} />
        <button type="submit" className="rounded border px-2 py-1 text-xs hover:bg-muted">
          Acknowledge low evidence &amp; continue
        </button>
      </form>
    </div>
  );
}
