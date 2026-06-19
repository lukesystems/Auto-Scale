import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CrawlRunStatus } from "../types";
import type { DiscoveryPlan } from "../discovery/schema";

export interface SaveDiscoveryRunInput {
  runId?: string;
  projectId: string;
  status: CrawlRunStatus;
  queries?: DiscoveryPlan["queries"] | Json;
  primaryAdapter?: string;
  fallbackAdapters?: string[];
  candidatesFound?: number;
  error?: string | null;
  metadata?: Json;
  completed?: boolean;
}

export async function saveDiscoveryRun(input: SaveDiscoveryRunInput): Promise<string> {
  const supabase = createSupabaseServerClient();

  if (input.runId) {
    const { error } = await supabase
      .from("source_discovery_runs")
      .update({
        status: input.status,
        queries: (input.queries ?? []) as Json,
        primary_adapter: input.primaryAdapter ?? "exa",
        fallback_adapters: (input.fallbackAdapters ?? []) as Json,
        candidates_found: input.candidatesFound ?? 0,
        error: input.error ?? null,
        metadata: (input.metadata ?? {}) as Json,
        completed_at: input.completed ? new Date().toISOString() : null,
      })
      .eq("id", input.runId);

    if (error) throw new Error(error.message);
    return input.runId;
  }

  const { data, error } = await supabase
    .from("source_discovery_runs")
    .insert({
      project_id: input.projectId,
      status: input.status,
      queries: (input.queries ?? []) as Json,
      primary_adapter: input.primaryAdapter ?? "exa",
      fallback_adapters: (input.fallbackAdapters ?? []) as Json,
      candidates_found: input.candidatesFound ?? 0,
      error: input.error ?? null,
      metadata: (input.metadata ?? {}) as Json,
      completed_at: input.completed ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save discovery run.");
  return data.id;
}
