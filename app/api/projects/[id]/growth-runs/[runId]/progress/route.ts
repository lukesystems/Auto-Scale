import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { growthPhaseMessage } from "@/lib/growth-run/phase-labels";
import { getNextGrowthRunPhase } from "@/lib/growth-run/next-phase";
import { GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string; runId: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ error: "Supabase not configured." }, { status: 503 });
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const { data: project } = await supabase
    .from("projects")
    .select("id")
    .eq("id", params.id)
    .eq("owner_id", user.id)
    .maybeSingle();

  if (!project) {
    return NextResponse.json({ error: "Project not found." }, { status: 404 });
  }

  const { data: run } = await supabase
    .from("growth_runs")
    .select("id, status, phase, phase_status, error, started_at, completed_at, paused_at_phase")
    .eq("id", params.runId)
    .eq("project_id", params.id)
    .maybeSingle();

  if (!run) {
    return NextResponse.json({ error: "Growth run not found." }, { status: 404 });
  }

  const phaseStatus = (run.phase_status ?? {}) as Record<string, unknown>;
  let currentMessage = growthPhaseMessage(run.phase ?? "brief", phaseStatus);

  if (run.status === "awaiting_user_input" && run.phase) {
    const next = getNextGrowthRunPhase(run.phase);
    const nextLabel = next ? GROWTH_RUN_PHASE_LABELS[next] ?? next : "the next step";
    currentMessage = `Paused for your review — continue to start ${nextLabel}`;
  }

  return NextResponse.json({
    growthRunId: run.id,
    status: run.status,
    phase: run.phase,
    phaseStatus,
    currentMessage,
    error: run.error,
    pausedAtPhase: run.paused_at_phase ?? null,
    startedAt: run.started_at,
    completedAt: run.completed_at,
  });
}
