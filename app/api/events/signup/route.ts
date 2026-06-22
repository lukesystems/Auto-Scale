import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { verifyWebhookAuth } from "@/services/tracking/webhook-auth";
import { createHash } from "node:crypto";

/**
 * POST /api/events/signup
 *
 * Webhook entrypoint for app-side signup events. Founders POST here from
 * their backend whenever a new user signs up; we attach attribution back
 * to the tracked link / video that drove it.
 *
 * Auth (required): `Authorization: Bearer <project_id>.<webhook_secret>`.
 * The secret is derived per-project via HMAC from AUTOSCALE_WEBHOOK_SIGNING_KEY
 * (see services/tracking/webhook-auth.ts). Unauthenticated inserts are rejected.
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
  if (!projectId) {
    return NextResponse.json({ ok: false, error: "project_id required" }, { status: 400 });
  }

  const auth = verifyWebhookAuth(req.headers.get("authorization"), projectId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();

  let trackedLinkId =
    typeof body.tracked_link_id === "string" ? body.tracked_link_id : null;
  let videoId: string | null = null;
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

  const email = typeof body.email === "string" ? body.email : null;
  const emailHash = email
    ? createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 64)
    : null;

  const { data, error } = await admin
    .from("signup_events")
    .insert({
      project_id: projectId,
      tracked_link_id: trackedLinkId,
      video_id: videoId,
      external_user_id: typeof body.external_user_id === "string" ? body.external_user_id : null,
      email_hash: emailHash,
      source: "webhook",
      activated: Boolean(body.activated),
      activated_at: body.activated_at ? String(body.activated_at) : null,
      metadata: ((body.metadata as Record<string, unknown>) ?? {}) as never,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
