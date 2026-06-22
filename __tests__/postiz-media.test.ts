import { describe, expect, it } from "vitest";
import { buildPostizPayload, collectPostizMediaUrls } from "@/services/postiz/client";

describe("postiz media payload", () => {
  it("puts uploaded video attachments in the image array with id and path", () => {
    const body = buildPostizPayload(
      {
        channel: "int-1",
        scheduledFor: "2026-06-21T12:00:00.000Z",
        caption: "Test caption",
        platform: "tiktok",
      },
      [{ id: "media-1", path: "https://uploads.postiz.com/video.mp4" }]
    );
    const value = body.posts[0].value[0];
    expect(value.image).toEqual([
      { id: "media-1", path: "https://uploads.postiz.com/video.mp4" },
    ]);
  });

  it("collects mediaUrls and legacy imageUrls", () => {
    const urls = collectPostizMediaUrls({
      channel: "x",
      scheduledFor: "2026-06-21T12:00:00.000Z",
      caption: "c",
      mediaUrls: ["https://example.com/a.mp4"],
      imageUrls: ["https://example.com/a.mp4", "https://example.com/b.png"],
    });
    expect(urls).toHaveLength(2);
  });
});
