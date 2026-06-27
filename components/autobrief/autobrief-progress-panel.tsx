"use client";

import { CheckCircle2, Globe, Loader2 } from "lucide-react";
import type { AutoBriefProgressState } from "@/lib/autobrief/progress-types";
import { cn } from "@/lib/utils";

interface AutoBriefProgressPanelProps {
  progress: AutoBriefProgressState | null;
  title?: string;
  subtitle?: string;
  showSlowHint?: boolean;
}

export function AutoBriefProgressPanel({
  progress,
  title = "Analyzing your product…",
  subtitle = "AutoScale is reading your site and extracting product signals in real time.",
  showSlowHint = false,
}: AutoBriefProgressPanelProps) {
  const events = progress?.events ?? [];
  const currentMessage = progress?.currentMessage ?? "Starting…";
  const visibleEvents = events.slice(-8);

  return (
    <div className="py-6 space-y-6">
      <div className="text-center space-y-2">
        <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
          <Globe className="h-6 w-6 text-primary animate-pulse" />
        </div>
        <p className="font-medium text-lg">{title}</p>
        <p className="text-sm text-muted-foreground max-w-md mx-auto">{subtitle}</p>
      </div>

      <div className="max-w-lg mx-auto rounded-lg border border-primary/30 bg-primary/5 px-4 py-3">
        <div className="flex items-center gap-2 text-sm font-medium">
          <Loader2 className="h-4 w-4 animate-spin text-primary shrink-0" />
          <span>{currentMessage}</span>
        </div>
        {progress && (progress.pagesCrawled > 0 || progress.factsFound > 0) && (
          <p className="mt-1 text-xs text-muted-foreground pl-6">
            {progress.pagesCrawled > 0 ? `${progress.pagesCrawled} page${progress.pagesCrawled === 1 ? "" : "s"} read` : null}
            {progress.pagesCrawled > 0 && progress.factsFound > 0 ? " · " : null}
            {progress.factsFound > 0 ? `${progress.factsFound} signal${progress.factsFound === 1 ? "" : "s"} found` : null}
          </p>
        )}
      </div>

      {visibleEvents.length > 0 && (
        <ol className="space-y-2 max-w-lg mx-auto max-h-64 overflow-y-auto pr-1">
          {visibleEvents.map((event) => {
            const isLatest = event.id === visibleEvents[visibleEvents.length - 1]?.id;
            const isDone = event.status === "success";
            const isFailed = event.status === "failed";

            return (
              <li
                key={event.id}
                className={cn(
                  "rounded-lg border px-3 py-2.5 text-sm transition-all",
                  isLatest && !isFailed && "border-primary/30 bg-background/80",
                  !isLatest && "border-border/50 bg-background/40 opacity-80"
                )}
              >
                <div className="flex items-start gap-2.5">
                  <div className="mt-0.5 shrink-0">
                    {isDone ? (
                      <CheckCircle2 className="h-4 w-4 text-primary" />
                    ) : isFailed ? (
                      <span className="inline-block h-4 w-4 rounded-full bg-destructive/20" />
                    ) : isLatest ? (
                      <Loader2 className="h-4 w-4 animate-spin text-primary" />
                    ) : (
                      <CheckCircle2 className="h-4 w-4 text-muted-foreground/50" />
                    )}
                  </div>
                  <p className="text-left leading-relaxed">{event.message}</p>
                </div>
              </li>
            );
          })}
        </ol>
      )}

      <p className="text-center text-sm text-muted-foreground">
        This usually takes 30–90 seconds depending on the model and website.
      </p>
      {showSlowHint && (
        <p className="text-center text-sm text-amber-600 dark:text-amber-500 max-w-sm mx-auto">
          Still working — reasoning models may take 1–3 minutes for the final brief step.
        </p>
      )}
    </div>
  );
}
