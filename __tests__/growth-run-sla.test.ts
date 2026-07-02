import { describe, expect, it } from "vitest";
import { buildSlaTimingPatch, readNumericDetail } from "@/services/growth-run/sla";

describe("growth run SLA telemetry", () => {
  it("starts queued and running phases without duration", () => {
    expect(
      buildSlaTimingPatch({
        status: "pending",
        nowIso: "2026-07-01T00:00:00.000Z",
      })
    ).toEqual({ queued_at: "2026-07-01T00:00:00.000Z" });

    expect(
      buildSlaTimingPatch({
        status: "running",
        nowIso: "2026-07-01T00:00:05.000Z",
        existing: { queued_at: "2026-07-01T00:00:00.000Z" },
      })
    ).toEqual({
      queued_at: "2026-07-01T00:00:00.000Z",
      started_at: "2026-07-01T00:00:05.000Z",
      duration_ms: null,
    });
  });

  it("computes terminal duration from started_at", () => {
    expect(
      buildSlaTimingPatch({
        status: "succeeded",
        nowIso: "2026-07-01T00:01:00.000Z",
        existing: {
          queued_at: "2026-07-01T00:00:00.000Z",
          started_at: "2026-07-01T00:00:10.000Z",
        },
      })
    ).toEqual({
      queued_at: "2026-07-01T00:00:00.000Z",
      started_at: "2026-07-01T00:00:10.000Z",
      completed_at: "2026-07-01T00:01:00.000Z",
      duration_ms: 50_000,
    });
  });

  it("extracts provider latency and retries from detail aliases", () => {
    expect(readNumericDetail({ latencyMs: "1200" }, ["latencyMs"])).toBe(1200);
    expect(readNumericDetail({ retries: 1 }, ["retryCount", "retries"])).toBe(1);
    expect(readNumericDetail({ retries: "nope" }, ["retries"])).toBeNull();
  });
});
