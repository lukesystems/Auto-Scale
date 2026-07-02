import { charsToTimedWords } from "./captions/paging";
import type { CharacterAlignment } from "@/services/voiceover/provider";

function normalizeToken(token: string): string {
  return token.toLowerCase().replace(/[^\w]/g, "");
}

/**
 * Derive per-scene durations from ElevenLabs character alignment when scene
 * voiceover lines can be matched to timed words. Returns null on poor match.
 */
export function deriveSceneDurationsFromAlignment(
  scenes: Array<{ voiceover_line?: string | null; duration_seconds: number | string }>,
  alignment: CharacterAlignment,
  minDuration = 0.5
): number[] | null {
  const words = charsToTimedWords(alignment);
  if (!words.length) return null;

  const durations: number[] = [];
  let wordIdx = 0;

  for (const scene of scenes) {
    const tokens = (scene.voiceover_line ?? "").trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      durations.push(Math.max(minDuration, Number(scene.duration_seconds)));
      continue;
    }

    const sceneStart =
      wordIdx < words.length ? words[wordIdx]!.startSeconds : words.at(-1)!.endSeconds;
    let matched = 0;

    for (const token of tokens) {
      const target = normalizeToken(token);
      if (!target) continue;
      while (wordIdx < words.length) {
        const w = words[wordIdx]!;
        wordIdx++;
        if (normalizeToken(w.text) === target) {
          matched++;
          break;
        }
      }
    }

    if (matched < Math.ceil(tokens.length * 0.5)) {
      return null;
    }

    const sceneEnd =
      wordIdx > 0 ? words[wordIdx - 1]!.endSeconds : sceneStart;
    durations.push(Math.max(minDuration, sceneEnd - sceneStart + 0.12));
  }

  return durations.length === scenes.length ? durations : null;
}
