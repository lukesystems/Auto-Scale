import { runRenderWorkerUntilIdle } from "@/services/video-factory/render-worker";

async function main() {
  const growthRunId = process.env.GROWTH_RUN_ID?.trim() || undefined;
  const maxBatches = process.env.AUTOSCALE_RENDER_WORKER_MAX_BATCHES
    ? Number.parseInt(process.env.AUTOSCALE_RENDER_WORKER_MAX_BATCHES, 10)
    : undefined;

  const result = await runRenderWorkerUntilIdle({
    growthRunId,
    maxBatches: Number.isFinite(maxBatches) ? maxBatches : undefined,
  });

  console.log(JSON.stringify({ ok: true, growthRunId: growthRunId ?? null, ...result }));
}

main().catch((err) => {
  console.error(
    JSON.stringify({
      ok: false,
      error: err instanceof Error ? err.message : String(err),
    })
  );
  process.exit(1);
});
