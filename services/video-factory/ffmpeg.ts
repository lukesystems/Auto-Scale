import "server-only";

import { execFile } from "node:child_process";
import { promisify } from "node:util";
import ffmpegPath from "ffmpeg-static";

const execFileAsync = promisify(execFile);

export function getFfmpegPath(): string {
  const path = ffmpegPath ?? process.env.FFMPEG_PATH;
  if (!path) {
    throw new Error("ffmpeg not found. Install ffmpeg-static or set FFMPEG_PATH.");
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
    const message =
      err && typeof err === "object" && "stderr" in err
        ? String((err as { stderr: string }).stderr)
        : err instanceof Error
          ? err.message
          : String(err);
    throw new Error(`ffmpeg failed: ${message}`);
  }
}

export function isFfmpegAvailable(): boolean {
  return Boolean(ffmpegPath ?? process.env.FFMPEG_PATH);
}
