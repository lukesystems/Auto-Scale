import { describe, expect, it } from "vitest";
import {
  testPostBridgeConnection,
  uploadMediaFromUrl,
  sendToPostBridge,
} from "@/services/postbridge/client";

const SMOKE = process.env.POST_BRIDGE_SMOKE_TEST === "1";
const creds = {
  apiKey: process.env.POST_BRIDGE_API_KEY ?? "",
  apiUrl: process.env.POST_BRIDGE_API_URL,
};
const accountId = process.env.POST_BRIDGE_SMOKE_ACCOUNT_ID;
const videoUrl =
  process.env.POST_BRIDGE_SMOKE_VIDEO_URL ??
  "https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4";

describe.skipIf(!SMOKE)("postbridge video smoke (live)", () => {
  it("connects to Post Bridge", async () => {
    const result = await testPostBridgeConnection(creds);
    expect(result.ok).toBe(true);
  });

  it("uploads an MP4 and schedules a post", async () => {
    if (!accountId) {
      throw new Error("Set POST_BRIDGE_SMOKE_ACCOUNT_ID for smoke test");
    }
    if (!creds.apiKey) {
      throw new Error("Set POST_BRIDGE_API_KEY for smoke test");
    }

    const media = await uploadMediaFromUrl(creds, videoUrl);
    expect(media.id).toBeTruthy();

    const scheduledFor = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const result = await sendToPostBridge(creds, {
      accountId,
      scheduledFor,
      caption: "[AutoScale smoke] MP4 media upload test — safe to delete",
      platform: "tiktok",
      mediaIds: [media.id],
      externalRef: `smoke_${Date.now()}`,
    });
    expect(result.ok).toBe(true);
    expect(result.remoteId).toBeTruthy();
  }, 180_000);
});
