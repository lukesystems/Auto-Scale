import type { Json } from "@/lib/supabase/types";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { CrawlRunStatus } from "../types";

export interface SavePatternRunInput {
  runId?: string;
  projectId: string;
  status: CrawlRunStatus;
  sourceCount?: number;
  patternCount?: number;
  error?: string | null;
  metadata?: Json;
  completed?: boolean;
}

export async function savePatternRun(input: SavePatternRunInput): Promise<string> {
  const supabase = createSupabaseServerClient();

  if (input.runId) {
    const { error } = await supabase
      .from("market_pattern_runs")
      .update({
        status: input.status,
        source_count: input.sourceCount ?? 0,
        pattern_count: input.patternCount ?? 0,
        error: input.error ?? null,
        metadata: (input.metadata ?? {}) as Json,
        completed_at: input.completed ? new Date().toISOString() : null,
      })
      .eq("id", input.runId);

    if (error) throw new Error(error.message);
    return input.runId;
  }

  const { data, error } = await supabase
    .from("market_pattern_runs")
    .insert({
      project_id: input.projectId,
      status: input.status,
      source_count: input.sourceCount ?? 0,
      pattern_count: input.patternCount ?? 0,
      error: input.error ?? null,
      metadata: (input.metadata ?? {}) as Json,
      completed_at: input.completed ? new Date().toISOString() : null,
    })
    .select("id")
    .single();

  if (error || !data) throw new Error(error?.message ?? "Failed to save pattern run.");
  return data.id;
}
