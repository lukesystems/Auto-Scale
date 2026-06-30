import "server-only";

import { existsSync, readdirSync } from "node:fs";
import { join } from "node:path";

import type { AudioMode } from "./production-options";
import type { ProductionFormat } from "./production-options";
import { bgmMoodForFormat } from "./production-options";

const BGM_DIR = join(process.cwd(), "public", "audio", "bgm");

/** Bundled royalty-free track filenames (CC0 / generated ambient loops). */
export const BGM_TRACKS = [
  { id: "upbeat-focus", file: "upbeat-focus.mp3", mood: "energetic" },
  { id: "calm-ambient", file: "calm-ambient.mp3", mood: "calm" },
  { id: "tech-pulse", file: "tech-pulse.mp3", mood: "tech" },
] as const;

export type BgmMood = (typeof BGM_TRACKS)[number]["mood"];

/**
 * Pick a background music track path for assembly.
 * Falls back to the first existing file in public/audio/bgm/.
 */
export function selectBackgroundMusicPath(opts?: {
  mood?: BgmMood;
  seed?: string;
  productionFormat?: ProductionFormat;
}): string | null {
  const mood = opts?.mood ?? (opts?.productionFormat ? bgmMoodForFormat(opts.productionFormat) : undefined);
  const candidates = BGM_TRACKS.map((t) => ({
    ...t,
    path: join(BGM_DIR, t.file),
  })).filter((t) => existsSync(t.path));

  if (!candidates.length) {
    if (existsSync(BGM_DIR)) {
      const files = readdirSync(BGM_DIR).filter((f) => /\.(mp3|m4a|wav)$/i.test(f));
      if (files[0]) return join(BGM_DIR, files[0]);
    }
    return null;
  }

  if (mood) {
    const match = candidates.find((c) => c.mood === mood);
    if (match) return match.path;
  }

  if (opts?.seed) {
    let hash = 0;
    for (let i = 0; i < opts.seed.length; i++) {
      hash = (hash * 31 + opts.seed.charCodeAt(i)) >>> 0;
    }
    return candidates[hash % candidates.length]!.path;
  }

  return candidates[0]!.path;
}

/** Volume for background music when mixed with voice (ducked). */
export const BGM_DUCKED_VOLUME = 0.12;

/** Volume for background music when music-only (no voice). */
export const BGM_SOLO_VOLUME = 0.45;

export function backgroundMusicVolumeForMode(mode: AudioMode): number {
  if (mode === "music_only") return BGM_SOLO_VOLUME;
  if (mode === "voiceover_bgm") return BGM_DUCKED_VOLUME;
  return 0;
}

export function shouldDuckMusicUnderVoice(mode: AudioMode): boolean {
  return mode === "voiceover_bgm";
}
