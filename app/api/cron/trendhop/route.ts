import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runDueTrendHops } from "@/services/trendhop/schedule";

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

  const result = await runDueTrendHops();
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return handleCron(req);
}

export async function POST(req: NextRequest) {
  return handleCron(req);
}
