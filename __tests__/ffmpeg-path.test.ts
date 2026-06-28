import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";

vi.mock("ffmpeg-static", () => ({
  default: "/mock/ffmpeg-static/path",
}));

describe("getFfmpegPath", () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    delete process.env.FFMPEG_PATH;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it("prefers trimmed FFMPEG_PATH over ffmpeg-static", async () => {
    process.env.FFMPEG_PATH = "  C:\\ffmpeg\\bin\\ffmpeg.exe  ";
    const { getFfmpegPath } = await import("@/services/video-factory/ffmpeg");
    expect(getFfmpegPath()).toBe("C:\\ffmpeg\\bin\\ffmpeg.exe");
  });

  it("falls back to ffmpeg-static when FFMPEG_PATH is unset", async () => {
    const { getFfmpegPath } = await import("@/services/video-factory/ffmpeg");
    expect(getFfmpegPath()).toBe("/mock/ffmpeg-static/path");
  });

  it("falls back to ffmpeg-static when FFMPEG_PATH is whitespace only", async () => {
    process.env.FFMPEG_PATH = "   ";
    const { getFfmpegPath } = await import("@/services/video-factory/ffmpeg");
    expect(getFfmpegPath()).toBe("/mock/ffmpeg-static/path");
  });

  it("isFfmpegAvailable is true when FFMPEG_PATH is set", async () => {
    process.env.FFMPEG_PATH = "/custom/ffmpeg";
    const { isFfmpegAvailable } = await import("@/services/video-factory/ffmpeg");
    expect(isFfmpegAvailable()).toBe(true);
  });
});
