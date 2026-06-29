import { GROWTH_RUN_PHASES, GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import { cn } from "@/lib/utils";

export function RunPhaseTimeline({
  currentPhase,
  phaseStatus,
}: {
  currentPhase: string;
  phaseStatus: Record<string, unknown>;
}) {
  return (
    <ol className="space-y-2">
      {GROWTH_RUN_PHASES.map((phase) => {
        const entry = phaseStatus[phase] as { status?: string } | undefined;
        const status = entry?.status ?? (phase === currentPhase ? "running" : "pending");
        const isCurrent = phase === currentPhase;
        return (
          <li
            key={phase}
            className={cn(
              "flex items-center gap-3 rounded-md px-2 py-1.5 text-sm",
              isCurrent && "bg-primary/5"
            )}
          >
            <span
              className={cn(
                "h-2 w-2 shrink-0 rounded-full",
                status === "succeeded" && "bg-emerald-500",
                status === "running" && "bg-primary animate-pulse",
                status === "failed" && "bg-destructive",
                status !== "succeeded" &&
                  status !== "running" &&
                  status !== "failed" &&
                  "bg-muted-foreground/30"
              )}
            />
            <span className={cn(status === "succeeded" ? "text-foreground" : "text-muted-foreground")}>
              {GROWTH_RUN_PHASE_LABELS[phase] ?? phase}
            </span>
          </li>
        );
      })}
    </ol>
  );
}
