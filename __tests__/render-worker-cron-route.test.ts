import { afterEach, describe, expect, it, vi } from "vitest";
import { NextRequest } from "next/server";

const runRenderWorkerUntilIdle = vi.fn();

vi.mock("@/lib/supabase/env", () => ({
  isSupabaseConfigured: () => true,
}));

vi.mock("@/services/video-factory/render-worker", () => ({
  runRenderWorkerUntilIdle,
}));

function req(path: string, init?: ConstructorParameters<typeof NextRequest>[1]) {
  return new NextRequest(`http://localhost${path}`, init);
}

describe("render worker cron route", () => {
  const originalEnv = { ...process.env };
  const originalFetch = global.fetch;

  afterEach(() => {
    process.env = { ...originalEnv };
    global.fetch = originalFetch;
    runRenderWorkerUntilIdle.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("proxies to Cloud Run when AUTOSCALE_RENDER_WORKER_URL is configured", async () => {
    vi.stubEnv("AUTOSCALE_CRON_SECRET", "cron-secret");
    vi.stubEnv("AUTOSCALE_RENDER_WORKER_URL", "https://worker.example");
    vi.stubEnv("AUTOSCALE_RENDER_WORKER_SECRET", "worker-secret");
    vi.stubEnv("NODE_ENV", "production");

    const fetchMock = vi.fn(async () => new Response(JSON.stringify({ ok: true, claimed: 1 }), { status: 200 }));
    global.fetch = fetchMock as typeof fetch;

    const { POST } = await import("@/app/api/cron/render-worker/route");
    const res = await POST(
      req("/api/cron/render-worker", {
        method: "POST",
        headers: {
          authorization: "Bearer cron-secret",
          "content-type": "application/json",
        },
        body: JSON.stringify({ growthRunId: "run-1" }),
      })
    );

    expect(res.status).toBe(200);
    expect(runRenderWorkerUntilIdle).not.toHaveBeenCalled();
    expect(fetchMock).toHaveBeenCalledWith(
      "https://worker.example/run",
      expect.objectContaining({
        method: "POST",
        headers: expect.objectContaining({ Authorization: "Bearer worker-secret" }),
        body: JSON.stringify({ growthRunId: "run-1", maxBatches: 3 }),
      })
    );
  });

  it("refuses local production rendering when Cloud Run is not configured", async () => {
    vi.stubEnv("AUTOSCALE_CRON_SECRET", "cron-secret");
    vi.stubEnv("AUTOSCALE_RENDER_WORKER_URL", "");
    vi.stubEnv("AUTOSCALE_RENDER_WORKER_SECRET", "");
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTOSCALE_RENDER_WORKER_LOCAL", "0");

    const { GET } = await import("@/app/api/cron/render-worker/route");
    const res = await GET(
      req("/api/cron/render-worker", {
        headers: { authorization: "Bearer cron-secret" },
      })
    );
    const body = (await res.json()) as { ok: boolean; error: string };

    expect(res.status).toBe(503);
    expect(body.ok).toBe(false);
    expect(body.error).toContain("refusing to run FFmpeg worker in Vercel production");
    expect(runRenderWorkerUntilIdle).not.toHaveBeenCalled();
  });
});
