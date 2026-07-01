import { NextRequest, NextResponse } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runRenderWorkerUntilIdle } from "@/services/video-factory/render-worker";

/**
 * Stage 3 async render worker.
 *
 * Trigger options:
 * - Fire-and-forget POST from orchestrator after enqueue (`kickRenderWorker`)
 * - Lightweight kick from progress poll (`kickRenderWorkerInProcess` in dev, this route in prod)
 * - Vercel Cron / external scheduler: GET/POST with `Authorization: Bearer $CRON_SECRET`
 */
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

async function handleWorker(req: NextRequest) {
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

  let growthRunId = req.nextUrl.searchParams.get("growthRunId") ?? undefined;
  if (req.method === "POST") {
    try {
      const body = (await req.json()) as { growthRunId?: string };
      if (body.growthRunId) growthRunId = body.growthRunId;
    } catch {
      // optional body
    }
  }

  const result = await runRenderWorkerUntilIdle({ growthRunId, maxBatches: 3 });
  return NextResponse.json({ ok: true, ...result });
}

export async function GET(req: NextRequest) {
  return handleWorker(req);
}

export async function POST(req: NextRequest) {
  return handleWorker(req);
}
