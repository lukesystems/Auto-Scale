import { afterEach, describe, expect, it, vi } from "vitest";

const runRenderWorkerUntilIdle = vi.fn();

vi.mock("@/services/video-factory/render-worker", () => ({
  runRenderWorkerUntilIdle,
}));

describe("render worker service", () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
    runRenderWorkerUntilIdle.mockReset();
    vi.unstubAllEnvs();
    vi.resetModules();
  });

  it("accepts /run query params from external worker kicks", async () => {
    vi.stubEnv("NODE_ENV", "production");
    vi.stubEnv("AUTOSCALE_RENDER_WORKER_SECRET", "worker-secret");
    runRenderWorkerUntilIdle.mockResolvedValue({
      claimed: 0,
      processed: 0,
      succeeded: 0,
      failed: 0,
      errors: [],
    });

    const { createRenderWorkerServer } = await import("../scripts/render-worker-service");
    const server = createRenderWorkerServer();
    await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));

    try {
      const address = server.address();
      if (!address || typeof address === "string") throw new Error("server address unavailable");
      const res = await fetch(`http://127.0.0.1:${address.port}/run?growthRunId=run-1`, {
        method: "POST",
        headers: {
          Authorization: "Bearer worker-secret",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ maxBatches: 0 }),
      });

      expect(res.status).toBe(200);
      expect(await res.json()).toMatchObject({ ok: true, claimed: 0 });
      expect(runRenderWorkerUntilIdle).toHaveBeenCalledWith({
        growthRunId: "run-1",
        maxBatches: 0,
      });
    } finally {
      await new Promise<void>((resolve, reject) => {
        server.close((err) => (err ? reject(err) : resolve()));
      });
    }
  });
});
