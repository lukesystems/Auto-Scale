import "server-only";

import { createSupabaseServerClient } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/types";

type SupabaseClient = ReturnType<typeof createSupabaseServerClient>;
type Phase = Database["public"]["Tables"]["growth_runs"]["Row"]["phase"];
type Status = Database["public"]["Tables"]["growth_runs"]["Row"]["status"];

export interface CreateGrowthRunInput {
  projectId: string;
  options: Record<string, unknown>;
  trigger?: "manual" | "autopilot" | "scheduled";
  approvalMode?: "manual" | "per_format" | "autopilot";
  postingAggressiveness?: "conservative" | "balanced" | "aggressive";
  targetPlatforms?: Array<"tiktok" | "instagram" | "youtube">;
  brandConstraints?: Record<string, unknown>;
  parentRunId?: string | null;
}

export async function createGrowthRun(input: CreateGrowthRunInput) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("growth_runs")
    .insert({
      project_id: input.projectId,
      options: (input.options ?? {}) as never,
      trigger: input.trigger ?? "manual",
      approval_mode: input.approvalMode ?? "manual",
      posting_aggressiveness: input.postingAggressiveness ?? "balanced",
      target_platforms: (input.targetPlatforms ?? ["tiktok", "instagram", "youtube"]) as never,
      brand_constraints: (input.brandConstraints ?? {}) as never,
      parent_run_id: input.parentRunId ?? null,
      status: "pending",
      phase: "brief",
      started_at: new Date().toISOString(),
    })
    .select("*")
    .single();
  if (error) throw new Error(`growth_runs insert failed: ${error.message}`);
  return data!;
}

export async function setPhase(
  client: SupabaseClient,
  runId: string,
  phase: Phase,
  patch?: { status?: Status; error?: string | null; phase_status?: Record<string, unknown> }
) {
  const update: Partial<Database["public"]["Tables"]["growth_runs"]["Row"]> = {
    phase,
  };
  if (patch?.status) update.status = patch.status;
  if (patch?.error !== undefined) update.error = patch.error;
  if (patch?.phase_status) update.phase_status = patch.phase_status as never;
  const { error } = await client.from("growth_runs").update(update).eq("id", runId);
  if (error) throw new Error(`growth_runs update failed (${phase}): ${error.message}`);
}

export async function markPhaseStatus(
  client: SupabaseClient,
  runId: string,
  phase: Phase,
  status: "pending" | "running" | "succeeded" | "failed" | "skipped",
  details?: Record<string, unknown>
) {
  const { data, error } = await client
    .from("growth_runs")
    .select("phase_status")
    .eq("id", runId)
    .single();
  if (error) throw new Error(`growth_runs read phase_status: ${error.message}`);
  const existing = (data?.phase_status ?? {}) as Record<string, unknown>;
  existing[phase] = {
    status,
    at: new Date().toISOString(),
    ...details,
  };
  await client.from("growth_runs").update({ phase_status: existing as never }).eq("id", runId);
}

export async function completeRun(
  client: SupabaseClient,
  runId: string,
  status: "completed" | "failed" | "awaiting_approval"
) {
  await client
    .from("growth_runs")
    .update({
      status,
      phase: status === "completed" ? "done" : undefined,
      completed_at: status === "completed" ? new Date().toISOString() : null,
    } as never)
    .eq("id", runId);
}

export async function loadGrowthRun(runId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("growth_runs")
    .select("*")
    .eq("id", runId)
    .single();
  if (error) throw new Error(`growth_runs not found: ${error.message}`);
  return data!;
}

export async function loadProductBrief(projectId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("product_briefs")
    .select("*")
    .eq("project_id", projectId)
    .maybeSingle();
  if (error) throw new Error(`product_briefs read failed: ${error.message}`);
  return data;
}

export async function loadVideoEvidence(projectId: string, limit = 80) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_evidence")
    .select(
      "id, platform, video_url, account_handle, caption, detected_hook, detected_cta, format_guess, topic_guess, duration_seconds, view_count, like_count, share_count, source_confidence"
    )
    .eq("project_id", projectId)
    .order("source_confidence", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`video_evidence read failed: ${error.message}`);
  return data ?? [];
}

export async function loadVideoPatterns(projectId: string) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("video_patterns")
    .select("*")
    .eq("project_id", projectId)
    .order("confidence", { ascending: false });
  if (error) throw new Error(`video_patterns read failed: ${error.message}`);
  return data ?? [];
}

export async function loadConnectedAccounts(projectId: string, ids?: string[]) {
  const supabase = createSupabaseServerClient();
  let q = supabase.from("connected_accounts").select("*").eq("project_id", projectId);
  if (ids && ids.length) q = q.in("id", ids);
  const { data, error } = await q.eq("status", "active");
  if (error) throw new Error(`connected_accounts read failed: ${error.message}`);
  return data ?? [];
}

export async function loadLearningMemory(projectId: string, limit = 30) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("learning_memory")
    .select("kind, key, value, weight, evidence_count, last_seen_at")
    .eq("project_id", projectId)
    .order("weight", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`learning_memory read failed: ${error.message}`);
  return data ?? [];
}

export async function loadKillDecisions(projectId: string, limit = 20) {
  const supabase = createSupabaseServerClient();
  const { data, error } = await supabase
    .from("kill_decisions")
    .select("scope, scope_value, reason, metric_evidence, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (error) throw new Error(`kill_decisions read failed: ${error.message}`);
  return data ?? [];
}
