export interface TimedWord {
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface CaptionPage {
  words: TimedWord[];
  text: string;
  startSeconds: number;
  endSeconds: number;
}

export interface CaptionLayout {
  maxCharsPerLine: number;
  maxLinesPerPage: number;
  maxWordsPerPage: number;
  maxGapMs: number;
}

export const CAPTION_PRESETS: Record<string, CaptionLayout> = {
  tiktok: {
    maxCharsPerLine: 26,
    maxLinesPerPage: 2,
    maxWordsPerPage: 8,
    maxGapMs: 1000,
  },
  minimal: {
    maxCharsPerLine: 32,
    maxLinesPerPage: 1,
    maxWordsPerPage: 6,
    maxGapMs: 800,
  },
};

const FILLER_PATTERN = /^(um|uh|like|so|well)$/i;
const ARTIFACT_PATTERN = /^\[_TT_\d+\]$/;

export function filterCaptionWords(words: TimedWord[]): TimedWord[] {
  return words.filter((w) => {
    const t = w.text.trim();
    if (!t) return false;
    if (FILLER_PATTERN.test(t)) return false;
    if (ARTIFACT_PATTERN.test(t)) return false;
    if (/^#?\d+:$/.test(t)) return false;
    return true;
  });
}

/**
 * Group timed words into caption pages (content-machine pattern).
 * Never breaks mid-word; respects max words/chars per page.
 */
export function createCaptionPages(
  words: TimedWord[],
  layout: CaptionLayout = CAPTION_PRESETS.tiktok
): CaptionPage[] {
  const filtered = filterCaptionWords(words);
  if (!filtered.length) return [];

  const pages: CaptionPage[] = [];
  let current: TimedWord[] = [];
  let lineChars = 0;
  let lineCount = 1;

  function flush() {
    if (!current.length) return;
    pages.push({
      words: [...current],
      text: current.map((w) => w.text).join(" "),
      startSeconds: current[0]!.startSeconds,
      endSeconds: current[current.length - 1]!.endSeconds,
    });
    current = [];
    lineChars = 0;
    lineCount = 1;
  }

  for (let i = 0; i < filtered.length; i++) {
    const word = filtered[i]!;
    const prev = filtered[i - 1];
    const gapMs = prev ? (word.startSeconds - prev.endSeconds) * 1000 : 0;

    if (prev && gapMs > layout.maxGapMs) flush();
    if (current.length >= layout.maxWordsPerPage) flush();

    const nextLen = lineChars + (lineChars ? 1 : 0) + word.text.length;
    if (nextLen > layout.maxCharsPerLine) {
      lineCount += 1;
      lineChars = word.text.length;
      if (lineCount > layout.maxLinesPerPage) flush();
    } else {
      lineChars = nextLen;
    }

    if (/[.!?]$/.test(word.text) && current.length >= 2) {
      current.push(word);
      flush();
      continue;
    }

    current.push(word);
  }
  flush();
  return pages;
}

/** Extra pacing weight (in "character units") added after a word to approximate a natural pause. */
const SENTENCE_END_PAUSE_WEIGHT = 3.5;
const COMMA_PAUSE_WEIGHT = 1.75;

/** Relative pacing weight for a single token: longer words get proportionally more time,
 *  and words ending a sentence (or clause) get extra weight so the *following* silence
 *  reads as a pause rather than being swallowed by even division. */
function wordPacingWeight(token: string): number {
  // Strip surrounding punctuation for the character-length base weight, but keep at least 1
  // so even bare punctuation tokens get a slice.
  const bareLength = token.replace(/[^\p{L}\p{N}]/gu, "").length || 1;
  let weight = bareLength;
  if (/[.!?]$/.test(token)) {
    weight += SENTENCE_END_PAUSE_WEIGHT;
  } else if (/,$/.test(token)) {
    weight += COMMA_PAUSE_WEIGHT;
  }
  return weight;
}

/**
 * Derive word timings from scene-level durations when no TTS alignment exists.
 * This is a heuristic estimate, not real forced alignment: each word's slice of the
 * scene duration is weighted by its character length (longer words take longer to say)
 * plus extra weight after sentence-terminal punctuation or commas (natural pause), rather
 * than a flat even split across all words.
 */
export function wordsFromSceneDurations(
  scenes: Array<{ text: string; durationSeconds: number }>
): TimedWord[] {
  const words: TimedWord[] = [];
  let cursor = 0;
  for (const scene of scenes) {
    const tokens = scene.text.trim().split(/\s+/).filter(Boolean);
    if (!tokens.length) {
      cursor += scene.durationSeconds;
      continue;
    }
    const weights = tokens.map(wordPacingWeight);
    const totalWeight = weights.reduce((sum, w) => sum + w, 0) || tokens.length;
    const secondsPerWeightUnit = scene.durationSeconds / totalWeight;
    for (let i = 0; i < tokens.length; i++) {
      const duration = weights[i]! * secondsPerWeightUnit;
      words.push({
        text: tokens[i]!,
        startSeconds: cursor,
        endSeconds: cursor + duration,
      });
      cursor += duration;
    }
  }
  return words;
}

/** Convert ElevenLabs character alignment to timed words. */
export function charsToTimedWords(alignment: {
  characters: string[];
  character_start_times_seconds: number[];
  character_end_times_seconds: number[];
}): TimedWord[] {
  const words: TimedWord[] = [];
  let buf = "";
  let start = 0;
  let end = 0;

  for (let i = 0; i < alignment.characters.length; i++) {
    const ch = alignment.characters[i] ?? "";
    const chStart = alignment.character_start_times_seconds[i] ?? 0;
    const chEnd = alignment.character_end_times_seconds[i] ?? chStart;

    if (ch === " " || ch === "\n") {
      if (buf.trim()) {
        words.push({ text: buf.trim(), startSeconds: start, endSeconds: end });
      }
      buf = "";
      continue;
    }
    if (!buf) start = chStart;
    buf += ch;
    end = chEnd;
  }
  if (buf.trim()) {
    words.push({ text: buf.trim(), startSeconds: start, endSeconds: end });
  }
  return words;
}
