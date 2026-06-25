import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

type Client = SupabaseClient<Database>;

export type AutopilotSkipReason =
  | "no_connected_account"
  | "video_not_ready"
  | "quality_score_too_low"
  | "duplicate_hook_risk"
  | "duplicate_format_risk"
  | "account_health_paused"
  | "postiz_missing"
  | "platform_unsupported"
  | "no_final_mp4"
  | "no_captions";

export async function logAutopilotSkip(
  client: Client,
  input: {
    projectId: string;
    growthRunId?: string;
    videoId?: string;
    connectedAccountId?: string;
    reason: AutopilotSkipReason | string;
    details?: Record<string, unknown>;
  }
): Promise<void> {
  await client.from("autopilot_skip_log").insert({
    project_id: input.projectId,
    growth_run_id: input.growthRunId ?? null,
    video_id: input.videoId ?? null,
    connected_account_id: input.connectedAccountId ?? null,
    reason: input.reason,
    details: (input.details ?? {}) as never,
  } as never);
}
