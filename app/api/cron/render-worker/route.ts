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

function resolveExternalWorker(): { url: string; secret: string } | null {
  const workerUrl = process.env.AUTOSCALE_RENDER_WORKER_URL?.trim();
  const secret =
    process.env.AUTOSCALE_RENDER_WORKER_SECRET?.trim() ||
    process.env.AUTOSCALE_CRON_SECRET?.trim() ||
    process.env.CRON_SECRET?.trim();
  if (!workerUrl || !secret) return null;
  return { url: workerUrl.replace(/\/$/, ""), secret };
}

async function kickExternalWorker(input: {
  workerUrl: string;
  secret: string;
  growthRunId?: string;
  maxBatches: number;
}) {
  const res = await fetch(`${input.workerUrl}/run`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${input.secret}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      growthRunId: input.growthRunId,
      maxBatches: input.maxBatches,
    }),
    signal: AbortSignal.timeout(30_000),
  });

  const text = await res.text();
  let body: unknown = text;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  return { ok: res.ok, status: res.status, body };
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

  const externalWorker = resolveExternalWorker();
  if (externalWorker) {
    const result = await kickExternalWorker({
      workerUrl: externalWorker.url,
      secret: externalWorker.secret,
      growthRunId,
      maxBatches: 3,
    });
    return NextResponse.json(
      { ok: result.ok, mode: "cloud_run", workerStatus: result.status, worker: result.body },
      { status: result.ok ? 200 : 502 }
    );
  }

  if (process.env.NODE_ENV === "production" && process.env.AUTOSCALE_RENDER_WORKER_LOCAL !== "1") {
    return NextResponse.json(
      {
        ok: false,
        error: "AUTOSCALE_RENDER_WORKER_URL not configured; refusing to run FFmpeg worker in Vercel production",
      },
      { status: 503 }
    );
  }

  const result = await runRenderWorkerUntilIdle({ growthRunId, maxBatches: 3 });
  return NextResponse.json({ ok: true, mode: "local", ...result });
}

export async function GET(req: NextRequest) {
  return handleWorker(req);
}

export async function POST(req: NextRequest) {
  return handleWorker(req);
}
