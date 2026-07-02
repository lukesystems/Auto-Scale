import { describe, expect, it } from "vitest";
import { mapPostBridgeAnalyticsToSnapshot } from "@/services/metrics-ingestion/postbridge-map";

describe("Post Bridge metrics mapping", () => {
  it("maps analytics record fields to MetricsSnapshot", () => {
    const snapshot = mapPostBridgeAnalyticsToSnapshot(
      {
        id: "analytics_123",
        post_result_id: "pr_456",
        platform: "tiktok",
        view_count: 1500,
        like_count: 120,
        comment_count: 18,
        share_count: 9,
        save_count: 4,
      },
      { data: [] }
    );

    expect(snapshot.source).toBe("postbridge");
    expect(snapshot.views).toBe(1500);
    expect(snapshot.likes).toBe(120);
    expect(snapshot.comments).toBe(18);
    expect(snapshot.shares).toBe(9);
    expect(snapshot.saves).toBe(4);
    expect(snapshot.engagementRate).toBeCloseTo((120 + 18 + 9 + 4) / 1500, 5);
    expect(snapshot.watchTimeSeconds).toBeNull();
    expect(snapshot.impressions).toBeNull();
  });

  it("accepts alternate field names from provider payloads", () => {
    const snapshot = mapPostBridgeAnalyticsToSnapshot(
      {
        views: 800,
        likes: 40,
        comments: 5,
        impressions: 1200,
        duration: 22,
      },
      {}
    );

    expect(snapshot.views).toBe(800);
    expect(snapshot.likes).toBe(40);
    expect(snapshot.impressions).toBe(1200);
    expect(snapshot.watchTimeSeconds).toBe(22);
  });
});
