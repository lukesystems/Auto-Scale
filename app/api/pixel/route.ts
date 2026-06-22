import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";

/**
 * POST /api/pixel
 *
 * Public website pixel ingest. The pixel JS on the founder's site posts
 * here whenever it sees an event. We attribute to a tracked_link via the
 * `autoscale_link` URL parameter the redirect adds.
 *
 * Payload:
 *   {
 *     project_id: string;
 *     event_name: "pageview" | "signup" | "activation" | string;
 *     tracked_link_id?: string;
 *     session_id?: string;
 *     visitor_hash?: string;
 *     url?: string;
 *     referrer?: string;
 *     metadata?: Record<string, unknown>;
 *   }
 */
export async function POST(req: NextRequest) {
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
  const eventName = typeof body.event_name === "string" ? body.event_name : null;
  if (!projectId || !eventName) {
    return NextResponse.json({ ok: false, error: "project_id and event_name required" }, { status: 400 });
  }

  const admin = createSupabaseAdminClient();

  let trackedLinkId =
    typeof body.tracked_link_id === "string" ? body.tracked_link_id : null;
  let videoId: string | null = null;

  // Resolve the tracked_link if present so we can attach video_id.
  if (trackedLinkId) {
    const { data: link } = await admin
      .from("tracked_links")
      .select("id, project_id, video_id")
      .eq("id", trackedLinkId)
      .maybeSingle();
    if (!link || link.project_id !== projectId) {
      trackedLinkId = null;
    } else {
      videoId = link.video_id;
    }
  }

  const { error } = await admin.from("pixel_events").insert({
    project_id: projectId,
    tracked_link_id: trackedLinkId,
    video_id: videoId,
    event_name: eventName,
    session_id: typeof body.session_id === "string" ? body.session_id : null,
    visitor_hash: typeof body.visitor_hash === "string" ? body.visitor_hash : null,
    url: typeof body.url === "string" ? body.url : null,
    referrer: typeof body.referrer === "string" ? body.referrer : null,
    metadata: ((body.metadata as Record<string, unknown>) ?? {}) as never,
  });
  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    headers: {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type",
    },
  });
}
