"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Loader2, Play, Settings2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import { getNextGrowthRunPhase } from "@/lib/growth-run/next-phase";
import {
  resumeGrowthRunAction,
  rejectGrowthRunPhaseAction,
} from "@/app/(app)/unified-run/actions";

export function RunApprovalCard({
  projectId,
  growthRunId,
  pausedAtPhase,
}: {
  projectId: string;
  growthRunId: string;
  pausedAtPhase: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const completedLabel = GROWTH_RUN_PHASE_LABELS[pausedAtPhase ?? ""] ?? pausedAtPhase ?? "this step";
  const nextPhase = pausedAtPhase ? getNextGrowthRunPhase(pausedAtPhase) : null;
  const nextLabel = nextPhase ? GROWTH_RUN_PHASE_LABELS[nextPhase] ?? nextPhase : "the next step";

  function onContinue() {
    startTransition(async () => {
      const result = await resumeGrowthRunAction({ projectId, growthRunId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to continue.");
        return;
      }
      if (result.status === "awaiting_user_input") {
        toast.info("Paused again for your review.");
      } else {
        toast.success("Continuing AutoScale run…");
      }
      window.location.reload();
    });
  }

  function onCancel() {
    startTransition(async () => {
      const result = await rejectGrowthRunPhaseAction({ projectId, growthRunId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to cancel.");
        return;
      }
      toast.info("Run cancelled.");
      window.location.reload();
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-3">
      <div>
        <p className="text-sm font-semibold">Review before we continue</p>
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium text-foreground">{completedLabel}</span> is done. Review the
          evidence tabs below, then continue to start{" "}
          <span className="font-medium text-foreground">{nextLabel}</span>.
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          Pauses follow your{" "}
          <Link href="/settings" className="underline hover:text-foreground inline-flex items-center gap-1">
            <Settings2 className="h-3 w-3" />
            Settings → Approval policy
          </Link>
          . Choose &quot;Auto-approve everything&quot; to run without stopping.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onContinue} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Continue run
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending}>
          <X className="h-4 w-4" />
          Cancel run
        </Button>
      </div>
    </div>
  );
}
