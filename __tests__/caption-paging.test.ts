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

  it("weights fallback word timing by character length instead of an even split", () => {
    const words = wordsFromSceneDurations([
      { text: "a extraordinarily", durationSeconds: 2 },
    ]);
    expect(words).toHaveLength(2);
    const [short, long] = words as [typeof words[0], typeof words[0]];
    const shortDur = short.endSeconds - short.startSeconds;
    const longDur = long.endSeconds - long.startSeconds;
    // "extraordinarily" (15 chars) should take noticeably longer than "a" (1 char).
    expect(longDur).toBeGreaterThan(shortDur * 3);
    // Total duration still adds up to the scene duration.
    expect(long.endSeconds).toBeCloseTo(2, 5);
  });

  it("adds extra pacing weight after sentence-terminal punctuation", () => {
    const withPause = wordsFromSceneDurations([
      { text: "Stop. Go", durationSeconds: 2 },
    ]);
    const withoutPause = wordsFromSceneDurations([{ text: "Stop Go", durationSeconds: 2 }]);
    const pauseWordDur = withPause[0]!.endSeconds - withPause[0]!.startSeconds;
    const noPauseWordDur = withoutPause[0]!.endSeconds - withoutPause[0]!.startSeconds;
    // "Stop." should claim more of the scene duration than plain "Stop" thanks to the
    // sentence-end pause weighting, even though the visible word text is nearly identical.
    expect(pauseWordDur).toBeGreaterThan(noPauseWordDur);
  });

  it("applies word-pop scale transforms for the default bold_pop preset", () => {
    const words = [
      { text: "Hello", startSeconds: 0, endSeconds: 0.4 },
      { text: "world", startSeconds: 0.4, endSeconds: 0.8 },
    ];
    const pages = createCaptionPages(words, CAPTION_PRESETS.minimal);
    const ass = formatAssCaptions(pages, { karaoke: true });
    expect(ass).toContain("\\t(");
    expect(ass).toContain("\\fscx115\\fscy115");
  });

  it("clean_minimal preset omits per-word pop/karaoke emphasis and box background", () => {
    const words = [
      { text: "Hello", startSeconds: 0, endSeconds: 0.4 },
      { text: "world", startSeconds: 0.4, endSeconds: 0.8 },
    ];
    const pages = createCaptionPages(words, CAPTION_PRESETS.minimal);
    const ass = formatAssCaptions(pages, { karaoke: true, captionStyle: "clean_minimal" });
    // No scale/bold pop transform for this preset (word-level karaoke fill timing may still
    // be present since `karaoke: true` was explicitly requested by the caller).
    expect(ass).not.toContain("\\t(");
    expect(ass).toContain("BorderStyle");
    // BorderStyle 1 (no box) for clean_minimal, vs 3 (box) for bold_pop default.
    const styleLine = ass.split("\n").find((l) => l.startsWith("Style: Default"));
    expect(styleLine).toBeDefined();
    const fields = styleLine!.split(",");
    expect(fields[15]).toBe("1");
  });

  it("neon preset uses the brand colour for primary text and outline", () => {
    const pages = createCaptionPages(
      [{ text: "Hello", startSeconds: 0, endSeconds: 0.4 }],
      CAPTION_PRESETS.minimal
    );
    const ass = formatAssCaptions(pages, {
      captionStyle: "neon",
      brandColor: "#00FF00",
    });
    // #00FF00 -> ASS &HBBGGRR& -> &H0000FF00&
    expect(ass).toContain("&H0000FF00&");
  });

  it("defaults to white text when no brand colour is provided", () => {
    const pages = createCaptionPages(
      [{ text: "Hello", startSeconds: 0, endSeconds: 0.4 }],
      CAPTION_PRESETS.minimal
    );
    const ass = formatAssCaptions(pages, {});
    expect(ass).toContain("&H00FFFFFF&");
  });
});
