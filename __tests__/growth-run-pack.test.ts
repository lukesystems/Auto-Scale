import { describe, expect, it } from "vitest";
import { buildGrowthRunScheduleCsv } from "@/services/export/growth-run-pack";

describe("growth run export pack", () => {
  it("builds schedule csv with media urls", () => {
    const csv = buildGrowthRunScheduleCsv([
      {
        videoId: "v1",
        conceptId: "c1",
        platform: "tiktok",
        videoType: "slide",
        hook: "Hook line",
        caption: "Caption text",
        hashtags: ["#saas"],
        mediaUrl: "https://cdn.example.com/final.mp4",
        scheduledFor: "2026-06-21T10:00:00Z",
        accountHandle: "@founder",
      },
    ]);
    expect(csv).toContain("video_id,platform");
    expect(csv).toContain("v1");
    expect(csv).toContain("final.mp4");
  });
});
