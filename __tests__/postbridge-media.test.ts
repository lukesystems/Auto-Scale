import { describe, expect, it, vi } from "vitest";
import {
  buildPostBridgePayload,
  collectPostBridgeMediaUrls,
  mapPostBridgeRemoteStatus,
  resolvePostBridgeApiBase,
} from "@/services/postbridge/client";

describe("postbridge media payload", () => {
  it("builds create post body with media ids and social account", () => {
    const body = buildPostBridgePayload(
      {
        accountId: "acct-1",
        scheduledFor: "2026-06-21T12:00:00.000Z",
        caption: "Test caption",
        platform: "tiktok",
      },
      ["media-1"]
    );
    expect(body).toEqual({
      caption: "Test caption",
      scheduled_at: "2026-06-21T12:00:00.000Z",
      social_accounts: ["acct-1"],
      media: ["media-1"],
    });
  });

  it("appends cta, slides, and external ref to caption", () => {
    const body = buildPostBridgePayload(
      {
        accountId: "acct-1",
        scheduledFor: "2026-06-21T12:00:00.000Z",
        caption: "Hello",
        cta: "Try now",
        slides: [{ headline: "H1", body: "B1" }],
        externalRef: "ref-42",
      },
      []
    );
    expect(body.caption).toContain("Hello");
    expect(body.caption).toContain("Try now");
    expect(body.caption).toContain("Slide 1:");
    expect(body.caption).toContain("[ref:ref-42]");
    expect(body.media).toBeUndefined();
  });

  it("collects mediaUrls and legacy imageUrls", () => {
    const urls = collectPostBridgeMediaUrls({
      accountId: "x",
      scheduledFor: "2026-06-21T12:00:00.000Z",
      caption: "c",
      mediaUrls: ["https://example.com/a.mp4"],
      imageUrls: ["https://example.com/a.mp4", "https://example.com/b.png"],
    });
    expect(urls).toHaveLength(2);
  });

  it("maps remote status vocabulary", () => {
    expect(mapPostBridgeRemoteStatus("published")).toBe("posted");
    expect(mapPostBridgeRemoteStatus("scheduled")).toBe("scheduled");
    expect(mapPostBridgeRemoteStatus("failed")).toBe("failed");
  });
});

describe("postbridge api base", () => {
  it("defaults to v1 base", () => {
    expect(resolvePostBridgeApiBase()).toBe("https://api.post-bridge.com/v1");
  });

  it("normalizes custom base without duplicate /v1", () => {
    expect(resolvePostBridgeApiBase("https://api.post-bridge.com")).toBe(
      "https://api.post-bridge.com/v1"
    );
    expect(resolvePostBridgeApiBase("https://api.post-bridge.com/v1")).toBe(
      "https://api.post-bridge.com/v1"
    );
  });
});
