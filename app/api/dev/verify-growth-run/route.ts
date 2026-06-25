import { NextRequest, NextResponse } from "next/server";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { verifyGrowthRun, formatVerifyReport } from "@/services/growth-run/verify";

/**
 * GET /api/dev/verify-growth-run?project_id=&growth_run_id=
 *
 * Internal verification harness for one Growth Run. Requires authenticated user
 * who owns the project.
 */
export async function GET(req: NextRequest) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 503 });
  }

  const user = await requireUser();
  const projectId = req.nextUrl.searchParams.get("project_id");
  const growthRunId = req.nextUrl.searchParams.get("growth_run_id");

  if (!projectId || !growthRunId) {
    return NextResponse.json(
      { ok: false, error: "project_id and growth_run_id query params required" },
      { status: 400 }
    );
  }

  const supabase = createSupabaseServerClient();
  const { data: project } = await supabase
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.owner_id !== user.id) {
    return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
  }

  const report = await verifyGrowthRun({
    projectId,
    growthRunId,
    ownerId: user.id,
  });

  return NextResponse.json({
    ok: report.passed,
    report,
    text: formatVerifyReport(report),
  });
}
