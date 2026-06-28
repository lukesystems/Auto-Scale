"use client";

import type { MultiAccountScheduleResult } from "@/services/postiz/multi-account";
import type { PublishingProviderLabel } from "@/components/schedule-status-badge";
import { ScheduleStatusBadge } from "@/components/schedule-status-badge";

interface SchedulePreviewPanelProps {
  preview: MultiAccountScheduleResult;
  projectId: string;
  growthRunId: string;
  scheduleAction: (formData: FormData) => Promise<void>;
  providerLabel?: PublishingProviderLabel;
  hasSilentVoiceover?: boolean;
}

export function SchedulePreviewPanel({
  preview,
  projectId,
  growthRunId,
  scheduleAction,
  providerLabel = "Postiz",
  hasSilentVoiceover = false,
}: SchedulePreviewPanelProps) {
  if (!preview.preview.length) {
    return (
      <section className="rounded-lg border bg-card p-4 text-sm text-muted-foreground">
        No schedulable items. Approve videos that pass quality gate and connect {providerLabel} accounts.
      </section>
    );
  }

  return (
    <section className="rounded-xl border bg-card p-4 space-y-4">
      <header>
        <h2 className="text-sm font-semibold">Schedule preview</h2>
        <p className="text-xs text-muted-foreground mt-1">
          Review exactly what AutoScale will post before sending to {providerLabel}.
        </p>
      </header>
      <ul className="space-y-3">
        {preview.preview.map((item) => (
          <li key={`${item.videoId}-${item.accountId}`} className="rounded-lg border bg-background p-3 text-xs space-y-2">
            <div className="flex flex-wrap justify-between gap-2">
              <span className="font-medium">{item.platform} · {new Date(item.scheduledFor).toLocaleString()}</span>
              <div className="flex items-center gap-2">
                <ScheduleStatusBadge
                  state={item.qualityBlocked ? "unknown" : "queued"}
                  providerLabel={providerLabel}
                  detail={item.qualityBlocked ? item.blockReason ?? "blocked" : undefined}
                />
                <span>Quality: {item.qualityScore != null ? `${(item.qualityScore * 100).toFixed(0)}%` : "—"}</span>
              </div>
            </div>
            <p className="font-medium">{item.hook}</p>
            {item.mediaUrl ? (
              <video src={item.mediaUrl} controls className="w-full max-w-xs rounded border" preload="metadata" />
            ) : null}
            {item.caption ? <p className="text-muted-foreground whitespace-pre-wrap">{item.caption.slice(0, 280)}…</p> : null}
            {item.duplicateWarning ? (
              <p className="text-amber-700 dark:text-amber-300">Duplicate warning: {item.duplicateWarning}</p>
            ) : null}
            {item.formatWarning ? (
              <p className="text-amber-700 dark:text-amber-300">Format warning: {item.formatWarning}</p>
            ) : null}
            {item.audioNote ? <p className="text-muted-foreground">{item.audioNote}</p> : null}
            {item.qualityBlocked ? (
              <p className="text-red-600">Blocked: {item.blockReason ?? "quality too low"}</p>
            ) : null}
          </li>
        ))}
      </ul>
      <form action={scheduleAction} className="flex flex-wrap gap-2 items-center">
        <input type="hidden" name="projectId" value={projectId} />
        <input type="hidden" name="growthRunId" value={growthRunId} />
        {hasSilentVoiceover ? (
          <label className="flex items-center gap-1 text-xs text-amber-700 dark:text-amber-300 mr-2">
            <input type="checkbox" name="confirmSilentOverride" />
            Schedule silent voiceover anyway
          </label>
        ) : null}
        <button
          type="submit"
          className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
        >
          Schedule all safe via {providerLabel}
        </button>
        <a
          href={`/api/projects/${projectId}/growth/${growthRunId}/export`}
          className="rounded-md border px-4 py-2 text-sm font-medium hover:bg-muted"
        >
          Export instead
        </a>
      </form>
    </section>
  );
}
