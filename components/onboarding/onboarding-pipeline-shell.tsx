"use client";

import { CheckCircle2, Globe, Loader2, Rocket } from "lucide-react";
import type { AutoBrief } from "@/services/autobrief/schema";
import type { AutoBriefProgressState } from "@/lib/autobrief/progress-types";
import type { GrowthRunProgressState } from "@/hooks/use-growth-run-progress";
import { GROWTH_RUN_PHASES, GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import { ProjectDiscoveryPanel } from "./project-discovery-panel";
import { cn } from "@/lib/utils";

export type PipelineStage = "crawl" | "brief" | "growth" | "done" | "failed";

interface OnboardingPipelineShellProps {
  stage: PipelineStage;
  autobriefProgress: AutoBriefProgressState | null;
  growthProgress: GrowthRunProgressState | null;
  brief: AutoBrief | null;
  title?: string;
  subtitle?: string;
  showSlowHint?: boolean;
  thinEvidenceWarning?: string | null;
  ffmpegWarning?: string | null;
  errorMessage?: string | null;
}

export function OnboardingPipelineShell({
  stage,
  autobriefProgress,
  growthProgress,
  brief,
  title = "Building your growth engine…",
  subtitle = "We read your site, save your product brief internally, and launch your first Growth Run.",
  showSlowHint,
  thinEvidenceWarning,
  ffmpegWarning,
  errorMessage,
}: OnboardingPipelineShellProps) {
  const crawlMessage = autobriefProgress?.currentMessage ?? "Starting…";
  const growthMessage = growthProgress?.currentMessage ?? "Preparing Growth Run…";

  const discoveryPhases = ["deep_discovery", "video_discovery", "pattern_mining"] as const;
  const discoveryRunning = discoveryPhases.some((phase) => {
    const entry = growthProgress?.phaseStatus[phase] as { status?: string } | undefined;
    return entry?.status === "running" || growthProgress?.phase === phase;
  });
  const discoveryDone = discoveryPhases.every((phase) => {
    const entry = growthProgress?.phaseStatus[phase] as { status?: string } | undefined;
    return entry?.status === "succeeded";
  });
  const discoveryDetail =
    growthProgress?.phase === "deep_discovery"
      ? (growthProgress.currentMessage ?? "Gathering niche evidence…")
      : growthProgress?.phase === "video_discovery"
        ? (growthProgress.currentMessage ?? "Discovering video signals…")
        : growthProgress?.phase === "pattern_mining"
          ? (growthProgress.currentMessage ?? "Mining competitor patterns…")
          : discoveryDone
            ? "Niche evidence gathered"
            : "Queued after product brief";

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.1fr)]">
      <div className="space-y-5">
        <div className="text-center lg:text-left space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            {stage === "growth" || stage === "done" ? (
              <Rocket className="h-6 w-6 text-primary animate-pulse" />
            ) : (
              <Globe className="h-6 w-6 text-primary animate-pulse" />
            )}
          </div>
          <p className="font-medium text-lg">{title}</p>
          <p className="text-sm text-muted-foreground">{subtitle}</p>
        </div>

        <div className="rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
          <div className="flex items-center gap-2 text-sm font-medium">
            {stage === "done" ? (
              <CheckCircle2 className="h-4 w-4 text-primary shrink-0" />
            ) : (
              <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
            )}
            <span>
              {stage === "growth" || stage === "done" ? growthMessage : crawlMessage}
            </span>
          </div>
        </div>

        <ol className="space-y-2">
          <PipelineStep
            label="Read website"
            detail={crawlMessage}
            status={
              stage === "crawl"
                ? "running"
                : stage === "failed" && !brief
                  ? "failed"
                  : "done"
            }
          />
          <PipelineStep
            label="Build product brief"
            detail={brief ? "Brief saved internally" : "Extracting signals and writing brief…"}
            status={
              stage === "brief"
                ? "running"
                : brief
                  ? "done"
                  : stage === "crawl"
                    ? "pending"
                    : "pending"
            }
          />
          <PipelineStep
            label="Gather niche evidence"
            detail={discoveryDetail}
            status={
              stage === "growth" && discoveryRunning
                ? "running"
                : stage === "growth" && discoveryDone
                  ? "done"
                  : stage === "done"
                    ? "done"
                    : stage === "failed" && brief
                      ? "failed"
                      : "pending"
            }
          />
          <PipelineStep
            label="Run Growth Run"
            detail={growthMessage}
            status={
              stage === "growth"
                ? "running"
                : stage === "done"
                  ? "done"
                  : stage === "failed" && brief
                    ? "failed"
                    : "pending"
            }
          />
        </ol>

        {stage === "growth" && growthProgress && (
          <div className="overflow-x-auto rounded-lg border bg-card p-3 text-xs">
            <div className="flex flex-wrap gap-1">
              {GROWTH_RUN_PHASES.map((phase) => {
                const entry = growthProgress.phaseStatus[phase] as { status?: string } | undefined;
                const isCurrent = growthProgress.phase === phase;
                const tone =
                  entry?.status === "succeeded"
                    ? "bg-green-500/15 text-green-700 dark:text-green-300"
                    : entry?.status === "running" || isCurrent
                      ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                      : entry?.status === "failed"
                        ? "bg-red-500/15 text-red-700 dark:text-red-300"
                        : "bg-muted text-muted-foreground";
                return (
                  <span key={phase} className={cn("rounded px-2 py-1", tone)}>
                    {GROWTH_RUN_PHASE_LABELS[phase]}
                  </span>
                );
              })}
            </div>
          </div>
        )}

        {thinEvidenceWarning && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            {thinEvidenceWarning}
          </div>
        )}

        {ffmpegWarning && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm text-amber-700 dark:text-amber-400">
            {ffmpegWarning}
          </div>
        )}

        {errorMessage && (
          <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
            {errorMessage}
          </div>
        )}

        {showSlowHint && (
          <p className="text-sm text-amber-600 dark:text-amber-500">
            Still working — reasoning models and video generation can take several minutes.
          </p>
        )}
      </div>

      <ProjectDiscoveryPanel
        brief={brief}
        autobriefProgress={autobriefProgress}
        growthProgress={growthProgress}
      />
    </div>
  );
}

function PipelineStep({
  label,
  detail,
  status,
}: {
  label: string;
  detail: string;
  status: "pending" | "running" | "done" | "failed";
}) {
  return (
    <li
      className={cn(
        "rounded-lg border px-3 py-2.5 text-sm",
        status === "running" && "border-primary/30 bg-primary/5",
        status === "done" && "border-border/60 bg-background/40",
        status === "pending" && "border-border/40 opacity-60",
        status === "failed" && "border-destructive/30 bg-destructive/5"
      )}
    >
      <div className="flex items-start gap-2.5">
        <div className="mt-0.5 shrink-0">
          {status === "done" ? (
            <CheckCircle2 className="h-4 w-4 text-primary" />
          ) : status === "running" ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" />
          ) : status === "failed" ? (
            <span className="inline-block h-4 w-4 rounded-full bg-destructive/30" />
          ) : (
            <span className="inline-block h-4 w-4 rounded-full border-2 border-muted-foreground/30" />
          )}
        </div>
        <div>
          <p className="font-medium">{label}</p>
          <p className="text-xs text-muted-foreground mt-0.5">{detail}</p>
        </div>
      </div>
    </li>
  );
}
