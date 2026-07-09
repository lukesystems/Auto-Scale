"use client";

import { useState, useTransition } from "react";
import { Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cancelGrowthRunAction } from "@/app/(app)/projects/[id]/growth/actions";
import { canCancelGrowthRun } from "@/lib/growth-run/cancel-run";

export function CancelGrowthRunButton({
  projectId,
  growthRunId,
  runStatus,
  variant = "outline",
  size = "sm",
  label = "Cancel run",
  className,
}: {
  projectId: string;
  growthRunId: string;
  runStatus: string;
  variant?: "outline" | "ghost" | "destructive";
  size?: "sm" | "default";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();

  if (!canCancelGrowthRun(runStatus)) return null;

  function onConfirm() {
    startTransition(async () => {
      const result = await cancelGrowthRunAction({ projectId, growthRunId });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to cancel run.");
        return;
      }
      setOpen(false);
      toast.info("Run cancelled.");
      window.location.reload();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={className}
          disabled={pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <X className="h-4 w-4" />}
          {label}
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Cancel this Growth Run?</DialogTitle>
          <DialogDescription>
            The orchestrator will stop before the next phase. Work already saved (brief, concepts,
            partial videos) stays in the project, but the run will not continue to schedule or
            compound.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => setOpen(false)} disabled={pending}>
            Keep running
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={pending}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Cancel run
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function RunningGrowthRunBanner({
  projectId,
  growthRunId,
  runStatus,
  phase,
}: {
  projectId: string;
  growthRunId: string;
  runStatus: string;
  phase?: string | null;
}) {
  if (runStatus !== "running") return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>
          AutoScale Shorts is running
          {phase ? (
            <>
              {" "}
              — <span className="font-medium">{phase.replace(/_/g, " ")}</span>
            </>
          ) : null}
          . Progress updates live below.
        </span>
      </div>
      <CancelGrowthRunButton
        projectId={projectId}
        growthRunId={growthRunId}
        runStatus={runStatus}
        variant="outline"
        className="shrink-0"
      />
    </div>
  );
}
