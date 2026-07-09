"use client";

import { useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import { resumeGrowthRunAction } from "@/app/(app)/unified-run/actions";

export function RunRetryCard({
  projectId,
  growthRunId,
  failedPhase,
}: {
  projectId: string;
  growthRunId: string;
  failedPhase: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const label = GROWTH_RUN_PHASE_LABELS[failedPhase ?? ""] ?? failedPhase ?? "stage";

  function onRetry() {
    startTransition(async () => {
      const result = await resumeGrowthRunAction({ projectId, growthRunId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to retry run.");
        return;
      }
      if (result.status === "awaiting_user_input") {
        toast.info("Paused again for your review.");
      } else {
        toast.success("Retrying AutoScale Shorts run…");
      }
      window.location.reload();
    });
  }

  return (
    <div className="rounded-xl border border-destructive/40 bg-destructive/5 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Run failed at {label}</p>
        <p className="text-xs text-muted-foreground mt-1">
          Retry resumes from where the run stopped. Completed phases are reused when possible.
        </p>
      </div>
      <Button type="button" size="sm" onClick={onRetry} disabled={pending}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
        Retry run
      </Button>
    </div>
  );
}
