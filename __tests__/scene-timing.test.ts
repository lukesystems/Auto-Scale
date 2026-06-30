import { describe, expect, it } from "vitest";
import { deriveSceneDurationsFromAlignment } from "@/services/video-factory/scene-timing";

describe("deriveSceneDurationsFromAlignment", () => {
  it("returns per-scene durations from character alignment", () => {
    const alignment = {
      characters: "Hello world again".split(""),
      character_start_times_seconds: [0, 0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6],
      character_end_times_seconds: [0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0, 1.1, 1.2, 1.3, 1.4, 1.5, 1.6, 1.7],
    };
    const durations = deriveSceneDurationsFromAlignment(
      [
        { voiceover_line: "Hello world", duration_seconds: 2 },
        { voiceover_line: "again", duration_seconds: 2 },
      ],
      alignment
    );
    expect(durations).not.toBeNull();
    expect(durations![0]).toBeGreaterThanOrEqual(0.5);
    expect(durations![1]).toBeGreaterThanOrEqual(0.5);
  });

  it("returns null when alignment cannot match scene lines", () => {
    const alignment = {
      characters: ["H", "i"],
      character_start_times_seconds: [0, 0.1],
      character_end_times_seconds: [0.1, 0.2],
    };
    const durations = deriveSceneDurationsFromAlignment(
      [{ voiceover_line: "completely different text", duration_seconds: 2 }],
      alignment
    );
    expect(durations).toBeNull();
  });
});
