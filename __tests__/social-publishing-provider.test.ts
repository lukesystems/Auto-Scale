import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishingProvider,
  getPublishingProviderId,
  schedulePostViaProvider,
} from "@/services/social-publishing";

describe("social publishing provider", () => {
  const originalProvider = process.env.PUBLISHING_PROVIDER;

  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    if (originalProvider === undefined) {
      delete process.env.PUBLISHING_PROVIDER;
    } else {
      process.env.PUBLISHING_PROVIDER = originalProvider;
    }
    vi.unstubAllGlobals();
  });

  it("defaults to postbridge regardless of PUBLISHING_PROVIDER", () => {
    delete process.env.PUBLISHING_PROVIDER;
    expect(getPublishingProviderId()).toBe("postbridge");
    expect(getPublishingProvider().name).toBe("postbridge");
  });

  it("schedules via Post Bridge when configured", async () => {
    process.env.PUBLISHING_PROVIDER = "postbridge";

    const fetchMock = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (input, init) => {
        const url = String(input);
        if (url.includes("/media/create-upload-url")) {
          return new Response(JSON.stringify({ media_id: "m-1", upload_url: "https://upload.example/put" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        if (url === "https://upload.example/put") {
          return new Response(null, { status: 200 });
        }
        if (url.includes("example.com/video.mp4")) {
          return new Response(new Uint8Array([1, 2, 3]), {
            status: 200,
            headers: { "Content-Type": "video/mp4", "Content-Length": "3" },
          });
        }
        if (url.endsWith("/posts")) {
          expect(init?.headers).toMatchObject({
            Authorization: "Bearer pb_live_test",
          });
          return new Response(JSON.stringify({ data: { id: "post-99" } }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }
        throw new Error(`Unexpected fetch: ${url}`);
      });

    const result = await schedulePostViaProvider(
      { provider: "postbridge", apiKey: "pb_live_test", source: "managed" },
      {
        accountId: "42",
        scheduledFor: "2026-07-01T12:00:00.000Z",
        caption: "Hello from AutoScale",
        mediaUrls: ["https://example.com/video.mp4"],
        platform: "tiktok",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("scheduled");
    expect(result.remoteId).toBe("post-99");
    expect(fetchMock).toHaveBeenCalled();
  });
});
