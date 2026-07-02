"use client";

import { GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import {
  GROWTH_RUN_STAGES,
  resolveRunStage,
  type GrowthRunStageId,
} from "@/lib/growth-run/stages";
import { getNextGrowthRunPhase } from "@/lib/growth-run/next-phase";
import { cn } from "@/lib/utils";
import { CheckCircle2, Circle, Loader2 } from "lucide-react";

function phaseStatusForTimeline(
  phase: string,
  input: {
    currentPhase: string;
    phaseStatus: Record<string, unknown>;
    runStatus?: string;
    pausedAtPhase?: string | null;
    activeStage: GrowthRunStageId;
  }
): "pending" | "running" | "succeeded" | "failed" | "awaiting" {
  const entry = input.phaseStatus[phase] as { status?: string } | undefined;
  let status =
    entry?.status ??
    (phase === input.currentPhase && input.runStatus === "running" ? "running" : "pending");

  const awaitingInput =
    input.runStatus === "awaiting_user_input" && Boolean(input.pausedAtPhase);
  const nextAfterPause = input.pausedAtPhase
    ? getNextGrowthRunPhase(input.pausedAtPhase)
    : null;

  if (awaitingInput && phase === input.pausedAtPhase) {
    status = "succeeded";
  }
  if (awaitingInput && phase === nextAfterPause) {
    return "awaiting";
  }

  if (status === "failed") return "failed";
  if (status === "running") return "running";
  if (status === "succeeded") return "succeeded";
  if (status === "awaiting") return "awaiting";
  return "pending";
}

function stageAggregateStatus(
  stageId: GrowthRunStageId,
  input: {
    currentPhase: string;
    phaseStatus: Record<string, unknown>;
    runStatus?: string;
    pausedAtPhase?: string | null;
    activeStage: GrowthRunStageId;
  }
): "pending" | "running" | "done" | "awaiting" {
  const stage = GROWTH_RUN_STAGES.find((s) => s.id === stageId);
  if (!stage) return "pending";

  const statuses = stage.phases.map((phase) =>
    phaseStatusForTimeline(phase, input)
  );

  if (statuses.some((s) => s === "running")) return "running";
  if (
    input.runStatus === "awaiting_user_input" &&
    input.pausedAtPhase === stage.boundaryPhase
  ) {
    return "awaiting";
  }
  if (statuses.length > 0 && statuses.every((s) => s === "succeeded")) return "done";
  if (stageId < input.activeStage) return "done";
  if (stageId === input.activeStage && statuses.some((s) => s !== "pending")) {
    return statuses.every((s) => s === "succeeded") ? "done" : "running";
  }
  return "pending";
}

export function StageProgress({
  currentPhase,
  phaseStatus,
  runStatus,
  pausedAtPhase,
  currentStage,
}: {
  currentPhase: string;
  phaseStatus: Record<string, unknown>;
  runStatus?: string;
  pausedAtPhase?: string | null;
  currentStage?: number | null;
}) {
  const activeStage = resolveRunStage({
    current_stage: currentStage,
    paused_at_phase: pausedAtPhase,
    phase: currentPhase,
    status: runStatus,
  });

  const timelineInput = {
    currentPhase,
    phaseStatus,
    runStatus,
    pausedAtPhase,
    activeStage,
  };

  return (
    <div className="space-y-4">
      {GROWTH_RUN_STAGES.map((stage) => {
        const aggregate = stageAggregateStatus(stage.id, timelineInput);
        const isExpanded = stage.id === activeStage || aggregate === "awaiting";

        return (
          <section key={stage.id} className="space-y-2">
            <div
              className={cn(
                "flex items-start gap-2 rounded-md px-1 py-0.5",
                aggregate === "running" && "bg-primary/5",
                aggregate === "awaiting" && "bg-amber-500/10"
              )}
            >
              <StageIcon status={aggregate} />
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold leading-tight">{stage.title}</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {stage.rangeLabel}
                </p>
              </div>
            </div>

            {isExpanded ? (
              <ol className="ml-5 space-y-1 border-l border-border/60 pl-3">
                {stage.phases.map((phase) => {
                  const status = phaseStatusForTimeline(phase, timelineInput);
                  return (
                    <li
                      key={phase}
                      className={cn(
                        "flex items-center gap-2 text-xs",
                        status === "awaiting" && "text-amber-700 dark:text-amber-300"
                      )}
                    >
                      <span
                        className={cn(
                          "h-1.5 w-1.5 shrink-0 rounded-full",
                          status === "succeeded" && "bg-emerald-500",
                          status === "running" && "bg-primary animate-pulse",
                          status === "failed" && "bg-destructive",
                          status === "awaiting" && "bg-amber-500",
                          status === "pending" && "bg-muted-foreground/30"
                        )}
                      />
                      <span
                        className={cn(
                          status === "pending" && "text-muted-foreground"
                        )}
                      >
                        {GROWTH_RUN_PHASE_LABELS[phase] ?? phase}
                        {status === "awaiting" ? " — up next" : null}
                      </span>
                    </li>
                  );
                })}
              </ol>
            ) : null}
          </section>
        );
      })}
    </div>
  );
}

function StageIcon({
  status,
}: {
  status: "pending" | "running" | "done" | "awaiting";
}) {
  if (status === "done") {
    return <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />;
  }
  if (status === "running") {
    return <Loader2 className="mt-0.5 h-4 w-4 shrink-0 animate-spin text-primary" />;
  }
  if (status === "awaiting") {
    return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-amber-500" />;
  }
  return <Circle className="mt-0.5 h-4 w-4 shrink-0 text-muted-foreground/40" />;
}
