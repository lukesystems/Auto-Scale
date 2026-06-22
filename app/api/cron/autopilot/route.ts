import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runAutopilotTick } from "@/services/autopilot/run";

/**
 * POST /api/cron/autopilot
 *
 * Secured by AUTOSCALE_CRON_SECRET. Intended for external cron (Vercel cron,
 * GitHub Actions schedule, etc.).
 *
 * Body: { project_id: string, owner_id: string }
 * Header: Authorization: Bearer <AUTOSCALE_CRON_SECRET>
 */
export async function POST(req: NextRequest) {
  const secret = process.env.AUTOSCALE_CRON_SECRET?.trim();
  if (!secret) {
    return NextResponse.json({ ok: false, error: "AUTOSCALE_CRON_SECRET not configured" }, { status: 503 });
  }
  const auth = req.headers.get("authorization");
  if (auth !== `Bearer ${secret}`) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 503 });
  }

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const projectId = typeof body.project_id === "string" ? body.project_id : null;
  const ownerId = typeof body.owner_id === "string" ? body.owner_id : null;
  if (!projectId || !ownerId) {
    return NextResponse.json({ ok: false, error: "project_id and owner_id required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();
  const { data: project } = await admin
    .from("projects")
    .select("id, owner_id")
    .eq("id", projectId)
    .maybeSingle();
  if (!project || project.owner_id !== ownerId) {
    return NextResponse.json({ ok: false, error: "project not found" }, { status: 404 });
  }

  const result = await runAutopilotTick({ projectId, ownerId });
  return NextResponse.json({ ok: true, ...result });
}
