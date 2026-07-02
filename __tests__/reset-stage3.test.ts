import { describe, expect, it } from "vitest";
import {
  canRerunStage3,
  stage3RerunBlockReason,
} from "@/services/growth-run/reset-stage3";

describe("stage3 rerun guards", () => {
  it("blocks rerun while run is executing", () => {
    expect(canRerunStage3("running")).toBe(false);
    expect(stage3RerunBlockReason({ runStatus: "running", scheduleStatuses: [] })).toMatch(
      /still executing/i
    );
  });

  it("allows rerun when run is paused or finished", () => {
    expect(canRerunStage3("awaiting_user_input")).toBe(true);
    expect(canRerunStage3("failed")).toBe(true);
    expect(canRerunStage3("completed")).toBe(true);
    expect(stage3RerunBlockReason({ runStatus: "failed", scheduleStatuses: [] })).toBeNull();
  });

  it("blocks rerun when videos were posted", () => {
    expect(
      stage3RerunBlockReason({
        runStatus: "completed",
        scheduleStatuses: ["queued", "posted"],
      })
    ).toMatch(/already posted/i);
  });
});
