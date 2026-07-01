import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getStageForPhase } from "@/lib/growth-run/stages";

type Client = SupabaseClient<Database>;
type GrowthRunPhase = Database["public"]["Tables"]["growth_runs"]["Row"]["phase"];
type SlaStatus =
  Database["public"]["Tables"]["growth_run_sla_events"]["Row"]["status"];

export function readNumericDetail(
  details: Record<string, unknown> | undefined,
  keys: string[]
): number | null {
  if (!details) return null;
  for (const key of keys) {
    const value = details[key];
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return null;
}

export function buildSlaTimingPatch(input: {
  status: SlaStatus;
  nowIso: string;
  existing?: {
    queued_at?: string | null;
    started_at?: string | null;
  } | null;
}): {
  queued_at?: string;
  started_at?: string;
  completed_at?: string;
  duration_ms?: number | null;
} {
  const { status, nowIso, existing } = input;

  if (status === "pending") {
    return { queued_at: existing?.queued_at ?? nowIso };
  }

  if (status === "running") {
    return {
      queued_at: existing?.queued_at ?? nowIso,
      started_at: existing?.started_at ?? nowIso,
      duration_ms: null,
    };
  }

  const startedAt = existing?.started_at ?? existing?.queued_at ?? nowIso;
  const durationMs = Math.max(
    0,
    new Date(nowIso).getTime() - new Date(startedAt).getTime()
  );
  return {
    queued_at: existing?.queued_at ?? startedAt,
    started_at: startedAt,
    completed_at: nowIso,
    duration_ms: Number.isFinite(durationMs) ? durationMs : null,
  };
}

export async function recordGrowthRunSlaEvent(input: {
  client: Client;
  growthRunId: string;
  phase: GrowthRunPhase;
  status: SlaStatus;
  details?: Record<string, unknown>;
}): Promise<void> {
  const { client, growthRunId, phase, status, details } = input;
  const { data: run, error: runError } = await client
    .from("growth_runs")
    .select("project_id")
    .eq("id", growthRunId)
    .maybeSingle();
  if (runError || !run?.project_id) {
    throw new Error(`growth_run_sla_events run lookup failed: ${runError?.message ?? "not found"}`);
  }

  const { data: existing, error: existingError } = await client
    .from("growth_run_sla_events")
    .select("id, queued_at, started_at")
    .eq("growth_run_id", growthRunId)
    .eq("phase", phase)
    .maybeSingle();
  if (existingError) {
    throw new Error(`growth_run_sla_events read failed: ${existingError.message}`);
  }

  const nowIso = new Date().toISOString();
  const providerLatencyMs = readNumericDetail(details, [
    "providerLatencyMs",
    "provider_latency_ms",
    "latencyMs",
    "latency_ms",
  ]);
  const retryCount = readNumericDetail(details, ["retryCount", "retry_count", "retries"]);
  const stage = getStageForPhase(phase);
  const timing = buildSlaTimingPatch({ status, nowIso, existing });
  const payload = {
    project_id: run.project_id,
    growth_run_id: growthRunId,
    stage_id: stage?.id ?? null,
    phase,
    status,
    provider_latency_ms: providerLatencyMs,
    retry_count: retryCount ?? 0,
    details: (details ?? {}) as never,
    ...timing,
  };

  if (existing?.id) {
    const { error } = await client
      .from("growth_run_sla_events")
      .update(payload as never)
      .eq("id", existing.id);
    if (error) throw new Error(`growth_run_sla_events update failed: ${error.message}`);
    return;
  }

  const { error } = await client.from("growth_run_sla_events").insert(payload as never);
  if (error) throw new Error(`growth_run_sla_events insert failed: ${error.message}`);
}
