import type { Database } from "@/lib/supabase/types";

type RunStatus = Database["public"]["Tables"]["growth_runs"]["Row"]["status"];

export const CANCELLABLE_RUN_STATUSES = new Set<RunStatus>([
  "pending",
  "running",
  "awaiting_user_input",
]);

export function canCancelGrowthRun(status: string | null | undefined): boolean {
  return Boolean(status && CANCELLABLE_RUN_STATUSES.has(status as RunStatus));
}

/** Returns an error message when cancel must be blocked, else null. */
export function cancelGrowthRunBlockReason(
  status: string | null | undefined
): string | null {
  if (!status) return "Growth run not found.";
  if (status === "cancelled") return "Run is already cancelled.";
  if (status === "completed" || status === "live" || status === "scheduled") {
    return "Cannot cancel a finished run.";
  }
  if (status === "failed") {
    return "Run already failed. Retry or start a new run instead.";
  }
  if (status === "awaiting_approval") {
    return "Run is ready to schedule. Approve or reject videos instead of cancelling.";
  }
  if (!canCancelGrowthRun(status)) {
    return `Cannot cancel run in status "${status}".`;
  }
  return null;
}
