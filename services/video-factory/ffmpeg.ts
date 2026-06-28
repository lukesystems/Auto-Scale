import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export function getFfmpegPath(): string {
  const path = process.env.FFMPEG_PATH?.trim() || ffmpegPath;
  if (!path) {
    throw new Error("ffmpeg not found. Set FFMPEG_PATH or install ffmpeg-static.");
  }
  return path;
}

export async function runFfmpeg(args: string[]): Promise<void> {
  const bin = getFfmpegPath();
  try {
    await execFileAsync(bin, ["-y", "-hide_banner", "-loglevel", "error", ...args], {
      maxBuffer: 20 * 1024 * 1024,
    });
  } catch (err) {
    const stderr =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: string }).stderr).trim()
        : "";
    const message = err instanceof Error ? err.message : String(err);
    const detail = stderr || message;
    throw new Error(
      `ffmpeg failed (${bin}): ${detail.slice(0, 1200)}${detail.length > 1200 ? "…" : ""}`
    );
  }
}

export function isFfmpegAvailable(): boolean {
  return Boolean(process.env.FFMPEG_PATH?.trim() || ffmpegPath);
}
