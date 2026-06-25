import "server-only";

import { getFfmpegPath, isFfmpegAvailable } from "@/services/video-factory/ffmpeg";

export interface FfmpegHealthCheck {
  available: boolean;
  path: string | null;
  message: string;
  fixHint: string | null;
}

export function checkFfmpegHealth(): FfmpegHealthCheck {
  if (!isFfmpegAvailable()) {
    return {
      available: false,
      path: null,
      message: "ffmpeg is not installed or not available on PATH.",
      fixHint:
        "Install ffmpeg locally (https://ffmpeg.org/download.html) or ensure ffmpeg-static is installed. Set FFMPEG_PATH if using a custom binary.",
    };
  }
  try {
    const path = getFfmpegPath();
    return {
      available: true,
      path,
      message: "ffmpeg is available.",
      fixHint: null,
    };
  } catch (err) {
    return {
      available: false,
      path: null,
      message: err instanceof Error ? err.message : String(err),
      fixHint: "Set FFMPEG_PATH to your ffmpeg binary.",
    };
  }
}
