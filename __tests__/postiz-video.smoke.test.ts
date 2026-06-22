import { describe, expect, it } from "vitest";
import {
  testPostizConnection,
  uploadMediaFromUrl,
  sendToPostiz,
} from "@/services/postiz/client";

const SMOKE = process.env.POSTIZ_SMOKE_TEST === "1";
const creds = {
  apiUrl: process.env.POSTIZ_API_URL,
  apiKey: process.env.POSTIZ_API_KEY,
};
const integrationId = process.env.POSTIZ_SMOKE_INTEGRATION_ID;
const videoUrl =
  process.env.POSTIZ_SMOKE_VIDEO_URL ??
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

describe.skipIf(!SMOKE)("postiz video smoke (live)", () => {
  it("connects to Postiz", async () => {
    const result = await testPostizConnection(creds);
    expect(result.ok).toBe(true);
  });

  it("uploads an MP4 via upload-from-url and accepts it in a draft post payload", async () => {
    if (!integrationId) {
      throw new Error("Set POSTIZ_SMOKE_INTEGRATION_ID for smoke test");
    }
    const media = await uploadMediaFromUrl(creds, videoUrl);
    expect(media.id).toBeTruthy();
    expect(media.path).toMatch(/^https?:\/\//);

    const scheduledFor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await sendToPostiz(creds, {
      channel: integrationId,
      scheduledFor,
      caption: "[AutoScale smoke] MP4 media upload test — safe to delete",
      platform: "tiktok",
      media: [media],
      externalRef: `smoke_${Date.now()}`,
    });
    expect(result.ok).toBe(true);
    expect(result.remoteId).toBeTruthy();
  }, 180_000);
});
