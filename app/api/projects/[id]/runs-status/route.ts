import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

type RunRow = {
  id: string;
  kind: string;
  status: string;
  started_at: string | null;
  href: string;
};

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ runs: [] });
  }

  const projectId = params.id;
  const supabase = createSupabaseServerClient();
  const base = `/projects/${projectId}`;

  const [growth, trendhop, aiRuns] = await Promise.all([
    supabase
      .from("growth_runs")
      .select("id, status, phase, started_at, created_at")
      .eq("project_id", projectId)
      .in("status", ["pending", "running", "awaiting_approval", "live"])
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("trendhop_runs")
      .select("id, status, started_at, created_at")
      .eq("project_id", projectId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(5),
    supabase
      .from("ai_runs")
      .select("id, kind, status, created_at")
      .eq("project_id", projectId)
      .in("status", ["pending", "running"])
      .order("created_at", { ascending: false })
      .limit(5),
  ]);

  const discovery = await supabase
    .from("source_discovery_runs")
    .select("id, status, started_at, created_at")
    .eq("project_id", projectId)
    .eq("status", "running")
    .order("created_at", { ascending: false })
    .limit(5);

  const runs: RunRow[] = [
    ...(growth.data ?? []).map((r) => ({
      id: r.id,
      kind: "growth_run",
      status: r.status,
      started_at: r.started_at ?? r.created_at,
      href: `${base}/growth/${r.id}`,
    })),
    ...(trendhop.data ?? []).map((r) => ({
      id: r.id,
      kind: "trendhop",
      status: r.status,
      started_at: r.started_at ?? r.created_at,
      href: `${base}/trendwatch`,
    })),
    ...(discovery.data ?? []).map((r) => ({
      id: r.id,
      kind: "source_discovery",
      status: r.status,
      started_at: r.started_at ?? r.created_at,
      href: `${base}/sources`,
    })),
    ...(aiRuns.data ?? []).map((r) => ({
      id: r.id,
      kind: `ai:${r.kind}`,
      status: r.status,
      started_at: r.created_at,
      href: `/debug/ai-runs`,
    })),
  ];

  return NextResponse.json({ runs });
}
