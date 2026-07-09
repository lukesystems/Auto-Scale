"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { executeGrowthRunAction } from "@/app/(app)/projects/[id]/growth/actions";
import { CancelGrowthRunButton } from "@/components/growth/cancel-growth-run-button";

export function RunPageAutoExecutor({
  projectId,
  growthRunId,
  initialStatus,
  autoExecute,
}: {
  projectId: string;
  growthRunId: string;
  initialStatus: string;
  autoExecute: boolean;
}) {
  const router = useRouter();
  const startedRef = useRef(false);

  useEffect(() => {
    if (!autoExecute || startedRef.current) return;
    if (initialStatus !== "pending") return;

    startedRef.current = true;
    void executeGrowthRunAction({ projectId, growthRunId })
      .then((result) => {
        if (!result.ok) {
          toast.error(result.error);
        }
      })
      .finally(() => {
        router.refresh();
      });
  }, [autoExecute, growthRunId, initialStatus, projectId, router]);

  if (!autoExecute || initialStatus !== "pending") return null;

  return (
    <div className="rounded-xl border border-primary/30 bg-primary/5 p-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between text-sm">
      <div className="flex items-center gap-3 min-w-0">
        <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        <span>Starting AutoScale Shorts run — progress updates live below.</span>
      </div>
      <CancelGrowthRunButton
        projectId={projectId}
        growthRunId={growthRunId}
        runStatus={initialStatus}
        variant="outline"
        className="shrink-0"
      />
    </div>
  );
}
