import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  getPublishingProvider,
  getPublishingProviderId,
  POSTBRIDGE_PROVIDER_STUB_REASON,
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
    expect(getPublishingProvider().name).toBe("postiz");
  });

  it("selects export_only when configured", () => {
    process.env.PUBLISHING_PROVIDER = "export_only";
    expect(getPublishingProviderId()).toBe("export_only");
    expect(getPublishingProvider().name).toBe("export_only");
  });

  it("queues locally via export_only without remote calls", async () => {
    process.env.PUBLISHING_PROVIDER = "export_only";
    const fetchMock = vi.spyOn(globalThis, "fetch");

    const result = await schedulePostViaProvider(
      { provider: "export_only", source: "none" },
      {
        accountId: "42",
        scheduledFor: "2026-07-01T12:00:00.000Z",
        caption: "Hello from AutoScale",
        mediaUrls: ["https://example.com/video.mp4"],
        platform: "tiktok",
      }
    );

    expect(result.ok).toBe(true);
    expect(result.status).toBe("queued");
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("does not call Post Bridge APIs while stubbed", async () => {
    process.env.PUBLISHING_PROVIDER = "postbridge";
    const fetchMock = vi.spyOn(globalThis, "fetch");

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

    expect(result.ok).toBe(false);
    expect(result.error).toBe(POSTBRIDGE_PROVIDER_STUB_REASON);
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
