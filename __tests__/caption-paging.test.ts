import { describe, expect, it } from "vitest";
import {
  CAPTION_PRESETS,
  createCaptionPages,
  filterCaptionWords,
  wordsFromSceneDurations,
} from "@/services/video-factory/captions/paging";
import { formatAssCaptions, pagesToSrt } from "@/services/video-factory/captions/export-ass";

describe("caption paging", () => {
  it("respects max 8 words per page for tiktok preset", () => {
    const words = Array.from({ length: 20 }, (_, i) => ({
      text: `word${i}`,
      startSeconds: i * 0.3,
      endSeconds: (i + 1) * 0.3,
    }));
    const pages = createCaptionPages(words, CAPTION_PRESETS.tiktok);
    expect(pages.length).toBeGreaterThan(1);
    for (const page of pages) {
      expect(page.words.length).toBeLessThanOrEqual(8);
    }
  });

  it("filters filler words", () => {
    const filtered = filterCaptionWords([
      { text: "um", startSeconds: 0, endSeconds: 0.2 },
      { text: "Ship", startSeconds: 0.2, endSeconds: 0.5 },
      { text: "faster", startSeconds: 0.5, endSeconds: 0.8 },
    ]);
    expect(filtered.map((w) => w.text)).toEqual(["Ship", "faster"]);
  });

  it("derives word timings from scene durations", () => {
    const words = wordsFromSceneDurations([
      { text: "one two three", durationSeconds: 3 },
      { text: "four five", durationSeconds: 2 },
    ]);
    expect(words).toHaveLength(5);
    expect(words[0]?.text).toBe("one");
    expect(words[4]?.text).toBe("five");
  });

  it("exports ASS and SRT from pages", () => {
    const words = [
      { text: "Hello", startSeconds: 0, endSeconds: 0.4 },
      { text: "world", startSeconds: 0.4, endSeconds: 0.8 },
    ];
    const pages = createCaptionPages(words, CAPTION_PRESETS.minimal);
    const ass = formatAssCaptions(pages, { karaoke: true });
    expect(ass).toContain("[Events]");
    expect(ass).toContain("\\k");

    const srt = pagesToSrt(pages);
    expect(srt).toContain("Hello world");
    expect(srt).toMatch(/--> /);
  });
});
