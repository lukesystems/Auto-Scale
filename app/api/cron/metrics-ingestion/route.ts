import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runDueMetricsIngestion } from "@/services/metrics-ingestion/schedule";

function resolveCronSecret(): string | null {
  return (
    process.env.AUTOSCALE_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim() ||
    null
  );
}

function isAuthorized(req: NextRequest, secret: string): boolean {
  const auth = req.headers.get("authorization");
  if (auth === `Bearer ${secret}`) return true;
  // Vercel Cron may send CRON_SECRET in Authorization when CRON_SECRET env is set.
  const cronHeader = req.headers.get("x-cron-secret");
  return cronHeader === secret;
}

async function handleCron(req: NextRequest) {
  const secret = resolveCronSecret();
  if (!secret) {
    return NextResponse.json(
      { ok: false, error: "AUTOSCALE_CRON_SECRET or CRON_SECRET not configured" },
      { status: 503 }
    );
  }
  if (!isAuthorized(req, secret)) {
    return NextResponse.json({ ok: false, error: "unauthorized" }, { status: 401 });
  }
  if (!isSupabaseConfigured()) {
    return NextResponse.json({ ok: false, error: "supabase not configured" }, { status: 503 });
  }

  let sinceDays = 30;
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { since_days?: number };
      if (typeof body.since_days === "number" && body.since_days > 0) {
        sinceDays = body.since_days;
      }
    } catch {
      // optional body
    }
  }

  const result = await runDueMetricsIngestion({ sinceDays });
  return NextResponse.json({ ok: true, ...result });
}

/** Vercel Cron uses GET; external schedulers may POST with JSON body. */
export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
