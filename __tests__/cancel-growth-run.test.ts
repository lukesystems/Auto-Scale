import { describe, expect, it } from "vitest";
import {
  canCancelGrowthRun,
  cancelGrowthRunBlockReason,
  CANCELLABLE_RUN_STATUSES,
} from "@/lib/growth-run/cancel-run";

describe("cancel growth run guards", () => {
  it("allows cancel for active run statuses", () => {
    for (const status of CANCELLABLE_RUN_STATUSES) {
      expect(canCancelGrowthRun(status)).toBe(true);
      expect(cancelGrowthRunBlockReason(status)).toBeNull();
    }
  });

  it("blocks cancel for terminal or post-production statuses", () => {
    expect(canCancelGrowthRun("cancelled")).toBe(false);
    expect(cancelGrowthRunBlockReason("cancelled")).toMatch(/already cancelled/i);

    expect(canCancelGrowthRun("completed")).toBe(false);
    expect(cancelGrowthRunBlockReason("completed")).toMatch(/finished run/i);

    expect(canCancelGrowthRun("failed")).toBe(false);
    expect(cancelGrowthRunBlockReason("failed")).toMatch(/already failed/i);

    expect(canCancelGrowthRun("awaiting_approval")).toBe(false);
    expect(cancelGrowthRunBlockReason("awaiting_approval")).toMatch(/ready to schedule/i);
  });

  it("blocks cancel when run status is missing", () => {
    expect(canCancelGrowthRun(null)).toBe(false);
    expect(cancelGrowthRunBlockReason(null)).toMatch(/not found/i);
  });
});
