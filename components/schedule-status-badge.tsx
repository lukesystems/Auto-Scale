import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock, Download } from "lucide-react";

export type ScheduleStatusState = "posted" | "queued" | "exported" | "unknown";

export type PublishingProviderLabel = "Postiz" | "Post Bridge" | "Export";

interface ScheduleStatusBadgeProps {
  state: ScheduleStatusState;
  detail?: string | null;
  className?: string;
  /** Remote publisher label when state is posted (defaults to Postiz). */
  providerLabel?: PublishingProviderLabel;
}

export function getPostedViaLabel(providerLabel: PublishingProviderLabel = "Postiz"): string {
  if (providerLabel === "Post Bridge") return "Posted via Post Bridge";
  if (providerLabel === "Export") return "Exported manually";
  return "Posted via Postiz";
}

/**
 * Three explicit states used wherever schedule status appears:
 *  - Posted via active publisher (green)
 *  - Queued locally (amber)
 *  - Exported manually (slate)
 */
export function ScheduleStatusBadge({
  state,
  detail,
  className,
  providerLabel = "Postiz",
}: ScheduleStatusBadgeProps) {
  if (state === "posted") {
    return (
      <Badge variant="success" className={className}>
        <CheckCircle2 className="h-3 w-3" />
        {getPostedViaLabel(providerLabel)}
        {detail ? <span className="ml-1 opacity-80">· {detail}</span> : null}
      </Badge>
    );
  }
  if (state === "queued") {
    return (
      <Badge
        variant="outline"
        className={`border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-100 ${className ?? ""}`}
      >
        <Clock className="h-3 w-3" />
        Queued locally
        {detail ? <span className="ml-1 opacity-80">· {detail}</span> : null}
      </Badge>
    );
  }
  if (state === "exported") {
    return (
      <Badge variant="secondary" className={className}>
        <Download className="h-3 w-3" />
        Exported manually
        {detail ? <span className="ml-1 opacity-80">· {detail}</span> : null}
      </Badge>
    );
  }
  return (
    <Badge variant="outline" className={className}>
      Unknown
    </Badge>
  );
}

export function mapScheduleItemStatusToState(status: string | null | undefined): ScheduleStatusState {
  switch (status) {
    case "posted":
    case "published":
      return "posted";
    case "scheduled":
    case "queued":
    case "sending":
      return "queued";
    case "exported":
    case "manual_export":
      return "exported";
    default:
      return "unknown";
  }
}
