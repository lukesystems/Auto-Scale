import { describe, expect, it } from "vitest";
import { selectEligibleScheduleItems } from "@/services/metrics-ingestion/eligibility";
import { getMetricsAdapter } from "@/services/metrics-ingestion";
import { tiktokMetricsAdapter } from "@/services/metrics-ingestion/tiktok-adapter";

describe("metrics ingestion orchestrator", () => {
  it("selects posted schedule items with remote ids in the window", () => {
    const recent = new Date();
    recent.setDate(recent.getDate() - 3);

    const items = [
      {
        id: "a",
        project_id: "p1",
        growth_run_id: "r1",
        video_id: "v1",
        platform: "tiktok",
        status: "posted",
        postiz_post_id: "pb_post_1",
        posted_url: null,
        posted_at: recent.toISOString(),
        scheduled_for: recent.toISOString(),
      },
      {
        id: "b",
        project_id: "p1",
        growth_run_id: "r1",
        video_id: "v2",
        platform: "tiktok",
        status: "scheduled",
        postiz_post_id: "pb_post_2",
        posted_url: null,
        posted_at: null,
        scheduled_for: recent.toISOString(),
      },
      {
        id: "c",
        project_id: "p1",
        growth_run_id: "r1",
        video_id: "v3",
        platform: "tiktok",
        status: "posted",
        postiz_post_id: null,
        posted_url: null,
        posted_at: recent.toISOString(),
        scheduled_for: recent.toISOString(),
      },
    ];

    const eligible = selectEligibleScheduleItems(items, 30);
    expect(eligible.map((row) => row.id)).toEqual(["a"]);
  });

  it("returns Post Bridge adapter when provider is postbridge", () => {
    const adapter = getMetricsAdapter("tiktok", "postbridge");
    expect(adapter.name).toBe("postbridge");
  });

  it("platform stubs return unsupported when not on postbridge", async () => {
    const result = await tiktokMetricsAdapter.fetchMetrics(
      {
        remotePostId: "123",
        platform: "tiktok",
        projectId: "project",
      },
      { apiKey: "unused" }
    );
    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.supported).toBe(false);
      expect(result.reason).toContain("Post Bridge");
    }
  });
});
