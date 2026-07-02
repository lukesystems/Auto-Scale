import { describe, expect, it } from "vitest";
import { countExportableVideos, evaluateSlaRows, isReadyOrApprovedVideo } from "@/services/growth-run/loop1-contract";

describe("Loop 1 contract verifier", () => {
  it("counts only ready or approved videos with succeeded final MP4 public URLs", () => {
    const videos = [
      {
        id: "video-ready",
        concept_id: "concept-1",
        status: "ready",
        approval_status: "pending_review",
        final_asset_id: "asset-1",
      },
      {
        id: "video-approved",
        concept_id: "concept-2",
        status: "rendering",
        approval_status: "auto_approved",
        final_asset_id: "asset-2",
      },
      {
        id: "video-missing-url",
        concept_id: "concept-3",
        status: "ready",
        approval_status: "pending_review",
        final_asset_id: "asset-3",
      },
      {
        id: "video-not-ready",
        concept_id: "concept-4",
        status: "rendering",
        approval_status: "pending_review",
        final_asset_id: "asset-4",
      },
    ];

    const assets = new Map([
      ["asset-1", { id: "asset-1", kind: "final_mp4", status: "succeeded", public_url: "https://cdn/video-1.mp4" }],
      ["asset-2", { id: "asset-2", kind: "final_mp4", status: "succeeded", public_url: "https://cdn/video-2.mp4" }],
      ["asset-3", { id: "asset-3", kind: "final_mp4", status: "succeeded", public_url: null }],
      ["asset-4", { id: "asset-4", kind: "final_mp4", status: "succeeded", public_url: "https://cdn/video-4.mp4" }],
    ]);

    expect(videos.map(isReadyOrApprovedVideo)).toEqual([true, true, true, false]);
    expect(countExportableVideos(videos, assets)).toBe(2);
  });

  it("flags completed SLA rows over the target and succeeded rows missing duration", () => {
    const result = evaluateSlaRows(
      [
        { phase: "deep_discovery", status: "succeeded", duration_ms: 59_000 },
        { phase: "render", status: "succeeded", duration_ms: 61_000 },
        { phase: "schedule", status: "succeeded", duration_ms: null },
        { phase: "compound", status: "running", duration_ms: null },
      ],
      60_000
    );

    expect(result.completed.map((row) => row.phase)).toEqual(["deep_discovery", "render", "schedule"]);
    expect(result.overSla.map((row) => row.phase)).toEqual(["render"]);
    expect(result.missingDuration.map((row) => row.phase)).toEqual(["schedule"]);
  });
});
