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
  });

  it("defaults to postiz when PUBLISHING_PROVIDER is unset", () => {
    delete process.env.PUBLISHING_PROVIDER;
    expect(getPublishingProviderId()).toBe("postiz");
    expect(getPublishingProvider().id).toBe("postiz");
  });

  it("selects postbridge when configured", () => {
    process.env.PUBLISHING_PROVIDER = "postbridge";
    expect(getPublishingProviderId()).toBe("postbridge");
    expect(getPublishingProvider().id).toBe("postbridge");
  });

  it("schedules via postbridge with media_urls", async () => {
    process.env.PUBLISHING_PROVIDER = "postbridge";
    const fetchMock = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(JSON.stringify({ id: "pb_post_123" }), { status: 200 })
    );

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
    expect(result.remoteId).toBe("pb_post_123");
    expect(fetchMock).toHaveBeenCalledOnce();

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toContain("/posts");
    expect(init.method).toBe("POST");
    expect(init.headers).toMatchObject({
      Authorization: "Bearer pb_live_test",
      "Content-Type": "application/json",
    });

    const body = JSON.parse(String(init.body));
    expect(body.social_accounts).toEqual(["42"]);
    expect(body.media_urls).toEqual(["https://example.com/video.mp4"]);
    expect(body.caption).toContain("Hello from AutoScale");
  });
});
