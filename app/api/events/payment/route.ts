import { NextRequest, NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { verifyWebhookAuth } from "@/services/tracking/webhook-auth";

/**
 * POST /api/events/payment
 *
 * Webhook for paid conversions. Founders post here from Stripe/Paddle/etc.
 * Attribution: pass `tracked_link_id` from the original signup, or pass
 * `signup_event_id` if the signup was reported via /api/events/signup and
 * we'll back-fill the tracked_link_id / video_id from there.
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
  const amountCents =
    typeof body.amount_cents === "number"
      ? Math.round(body.amount_cents)
      : typeof body.amount === "number"
        ? Math.round(body.amount * 100)
        : null;
  if (!projectId || amountCents === null) {
    return NextResponse.json(
      { ok: false, error: "project_id and amount_cents (or amount) required" },
      { status: 400 }
    );
  }

  const auth = verifyWebhookAuth(req.headers.get("authorization"), projectId);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, error: auth.error }, { status: auth.status });
  }

  const admin = createSupabaseAdminClient();
  let trackedLinkId =
    typeof body.tracked_link_id === "string" ? body.tracked_link_id : null;
  let videoId: string | null = null;
  let signupEventId =
    typeof body.signup_event_id === "string" ? body.signup_event_id : null;

  if (signupEventId) {
    const { data: signup } = await admin
      .from("signup_events")
      .select("id, project_id, tracked_link_id, video_id")
      .eq("id", signupEventId)
      .maybeSingle();
    if (!signup || signup.project_id !== projectId) {
      signupEventId = null;
    } else {
      trackedLinkId = trackedLinkId ?? signup.tracked_link_id;
      videoId = signup.video_id;
    }
  }
  if (trackedLinkId && !videoId) {
    const { data: link } = await admin
      .from("tracked_links")
      .select("project_id, video_id")
      .eq("id", trackedLinkId)
      .maybeSingle();
    if (!link || link.project_id !== projectId) {
      trackedLinkId = null;
    } else {
      videoId = link.video_id;
    }
  }

  const { data, error } = await admin
    .from("payment_events")
    .insert({
      project_id: projectId,
      tracked_link_id: trackedLinkId,
      video_id: videoId,
      signup_event_id: signupEventId,
      amount_cents: amountCents,
      currency: typeof body.currency === "string" ? body.currency : "USD",
      external_payment_id:
        typeof body.external_payment_id === "string" ? body.external_payment_id : null,
      source: "webhook",
      metadata: ((body.metadata as Record<string, unknown>) ?? {}) as never,
    })
    .select("id")
    .single();

  if (error) {
    return NextResponse.json({ ok: false, error: error.message }, { status: 500 });
  }
  return NextResponse.json({ ok: true, id: data.id });
}
