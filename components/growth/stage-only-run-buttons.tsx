"use client";

import { useState, useTransition } from "react";
import { Loader2, Play } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GROWTH_RUN_STAGES } from "@/lib/growth-run/stages";
import { startStageRunAction } from "@/app/(app)/projects/[id]/growth/actions";

export function StageOnlyRunButtons({
  projectId,
  disabled = false,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const [activeStage, setActiveStage] = useState<number | null>(null);

  function onRunStage(stage: number) {
    setActiveStage(stage);
    startTransition(async () => {
      const result = await startStageRunAction({ projectId, stage });
      if (!result.ok) {
        toast.error(result.error ?? "Could not start stage run.");
        setActiveStage(null);
      }
      // Success path redirects via server action.
    });
  }

  return (
    <div className="space-y-3">
      <div>
        <h2 className="text-sm font-semibold">Run a single stage</h2>
        <p className="mt-1 text-xs text-muted-foreground">
          After your first run, re-run research, strategy, production, or scheduling independently.
        </p>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {GROWTH_RUN_STAGES.map((stage) => {
          const isLoading = pending && activeStage === stage.id;
          return (
            <Button
              key={stage.id}
              type="button"
              variant="outline"
              size="sm"
              className="h-auto justify-start gap-2 px-3 py-2 text-left"
              disabled={disabled || pending}
              onClick={() => onRunStage(stage.id)}
            >
              {isLoading ? (
                <Loader2 className="h-4 w-4 shrink-0 animate-spin" />
              ) : (
                <Play className="h-4 w-4 shrink-0" />
              )}
              <span className="min-w-0">
                <span className="block text-xs font-semibold">
                  Run Stage {stage.id}: {stage.title}
                </span>
                <span className="block text-[11px] font-normal text-muted-foreground line-clamp-2">
                  {stage.rangeLabel}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
      {disabled ? (
        <p className="text-xs text-amber-700 dark:text-amber-300">
          Finish or cancel the active run before starting another stage.
        </p>
      ) : null}
    </div>
  );
}
