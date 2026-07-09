"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Loader2, Play, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import { getNextGrowthRunPhase } from "@/lib/growth-run/next-phase";
import { continueGrowthRunStageAction } from "@/app/(app)/projects/[id]/growth/actions";
import { CancelGrowthRunButton } from "@/components/growth/cancel-growth-run-button";

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
      const result = await continueGrowthRunStageAction({ projectId, growthRunId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to continue.");
        return;
      }
      if (result.status === "awaiting_user_input") {
        toast.info("Paused again for your review.");
      } else {
        toast.success("Continuing AutoScale Shorts run…");
      }
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
          Micro-gates follow your{" "}
          <Link href="/settings" className="underline hover:text-foreground inline-flex items-center gap-1">
            <Settings2 className="h-3 w-3" />
            Settings → Approval policy
          </Link>
          . Macro stage boundaries always pause here regardless of policy.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" onClick={onContinue} disabled={pending}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Continue run
        </Button>
        <CancelGrowthRunButton
          projectId={projectId}
          growthRunId={growthRunId}
          runStatus="awaiting_user_input"
        />
      </div>
    </div>
  );
}
