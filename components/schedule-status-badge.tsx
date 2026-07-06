import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Clock } from "lucide-react";

export type ScheduleStatusState = "posted" | "queued" | "unknown";

export type PublishingProviderLabel = "Post Bridge";

interface ScheduleStatusBadgeProps {
  state: ScheduleStatusState;
  detail?: string | null;
  className?: string;
  providerLabel?: PublishingProviderLabel;
}

export function getPostedViaLabel(_providerLabel: PublishingProviderLabel = "Post Bridge"): string {
  return "Posted via Post Bridge";
}

export function ScheduleStatusBadge({
  state,
  detail,
  className,
  providerLabel = "Post Bridge",
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
        Queued remotely
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
    default:
      return "unknown";
  }
}
