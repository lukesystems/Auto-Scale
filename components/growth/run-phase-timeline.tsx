"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { GROWTH_RUN_PHASES, GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import { getNextGrowthRunPhase } from "@/lib/growth-run/next-phase";
import { cn } from "@/lib/utils";

export { StageProgress } from "@/components/growth/stage-progress";

export function RunPhaseTimeline({
  currentPhase,
  phaseStatus,
  runStatus,
  pausedAtPhase,
}: {
  currentPhase: string;
  phaseStatus: Record<string, unknown>;
  runStatus?: string;
  pausedAtPhase?: string | null;
}) {
  const awaitingInput = runStatus === "awaiting_user_input" && Boolean(pausedAtPhase);
  const nextAfterPause = pausedAtPhase ? getNextGrowthRunPhase(pausedAtPhase) : null;

  return (
    <ol className="space-y-2">
      {GROWTH_RUN_PHASES.map((phase) => {
        const entry = phaseStatus[phase] as { status?: string } | undefined;
        let status = entry?.status ?? (phase === currentPhase && runStatus === "running" ? "running" : "pending");

        if (awaitingInput && phase === pausedAtPhase) {
          status = "succeeded";
        }
        if (awaitingInput && phase === nextAfterPause) {
          status = "awaiting";
        }

        const isCurrent =
          runStatus === "running" && phase === currentPhase && status !== "succeeded";

        return (
          <li
            key={phase}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm",
              isCurrent && "bg-primary/5",
              status === "awaiting" && "bg-amber-500/10"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                status === "succeeded" && "bg-emerald-500",
                status === "running" && "bg-primary animate-pulse",
                status === "failed" && "bg-destructive",
                status === "awaiting" && "bg-amber-500",
                status !== "succeeded" &&
                  status !== "running" &&
                  status !== "failed" &&
                  status !== "awaiting" &&
                  "bg-muted-foreground/30"
              )}
            />
            <span
              className={cn(
                status === "succeeded" || status === "awaiting"
                  ? "text-foreground"
                  : "text-muted-foreground"
              )}
            >
              {GROWTH_RUN_PHASE_LABELS[phase] ?? phase}
              {status === "awaiting" ? " — waiting for you" : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/** Poll run progress and refresh the server page while a run is active. */
export function RunPageLiveUpdater({
  projectId,
  growthRunId,
  runStatus,
}: {
  projectId: string;
  growthRunId: string;
  runStatus: string;
}) {
  const router = useRouter();
  const shouldPoll = runStatus === "running" || runStatus === "pending";
  const pollMs = runStatus === "awaiting_user_input" ? 8000 : 4000;

  useEffect(() => {
    if (!shouldPoll) return;

    let cancelled = false;

    async function tick() {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/growth-runs/${growthRunId}/progress`,
          { cache: "no-store" }
        );
        if (!res.ok || cancelled) return;
        router.refresh();
      } catch {
        // ignore
      }
    }

    tick();
    const id = setInterval(tick, pollMs);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [projectId, growthRunId, shouldPoll, router]);

  return null;
}
