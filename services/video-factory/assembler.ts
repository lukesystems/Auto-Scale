import "server-only";

import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { runFfmpeg } from "./ffmpeg";

export interface SceneClipInput {
  /** Path to PNG or MP4 scene source on disk */
  filePath: string;
  kind: "image" | "video";
  durationSeconds: number;
}

export interface AssembleVideoInput {
  scenes: SceneClipInput[];
  voiceoverPath?: string;
  subtitlesPath?: string;
  outputPath: string;
  width?: number;
  height?: number;
}

/**
 * Assemble storyboard scene clips + optional voiceover + subtitles into one MP4.
 * Output: H.264 + AAC, 9:16 by default, suitable for TikTok/Reels/Shorts.
 */
export async function assembleVideo(input: AssembleVideoInput): Promise<void> {
  const width = input.width ?? 1080;
  const height = input.height ?? 1920;
  const dir = await mkdtemp(join(tmpdir(), "autoscale-asm-"));
  const scenePaths: string[] = [];

  try {
    for (let i = 0; i < input.scenes.length; i++) {
      const scene = input.scenes[i];
      const out = join(dir, `scene-${i}.mp4`);
      const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,format=yuv420p`;
      if (scene.kind === "video") {
        await runFfmpeg([
          "-i",
          scene.filePath,
          "-t",
          String(scene.durationSeconds),
          "-vf",
          vf,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-an",
          out,
        ]);
      } else {
        await runFfmpeg([
          "-loop",
          "1",
          "-i",
          scene.filePath,
          "-t",
          String(scene.durationSeconds),
          "-vf",
          vf,
          "-c:v",
          "libx264",
          "-preset",
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-an",
          out,
        ]);
      }
      scenePaths.push(out);
    }

    const listPath = join(dir, "concat.txt");
    await writeFile(
      listPath,
      scenePaths.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
    );
    const concatOut = join(dir, "concat.mp4");
    await runFfmpeg(["-f", "concat", "-safe", "0", "-i", listPath, "-c", "copy", concatOut]);

    const args: string[] = ["-i", concatOut];
    if (input.voiceoverPath) {
      args.push("-i", input.voiceoverPath);
    }

    const filters: string[] = [];
    let videoOut = "0:v";
    if (input.subtitlesPath) {
      const escaped = input.subtitlesPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      filters.push(`[0:v]subtitles='${escaped}'[vout]`);
      videoOut = "[vout]";
    }

    if (filters.length) {
      args.push("-filter_complex", filters.join(";"), "-map", videoOut);
    } else {
      args.push("-map", "0:v");
    }

    if (input.voiceoverPath) {
      args.push("-map", "1:a");
      args.push("-c:a", "aac", "-b:a", "128k", "-shortest");
    }

    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "veryfast",
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart",
      input.outputPath
    );

    await runFfmpeg(args);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}

export async function assembleVideoToBuffer(input: Omit<AssembleVideoInput, "outputPath">): Promise<Buffer> {
  const dir = await mkdtemp(join(tmpdir(), "autoscale-out-"));
  const outputPath = join(dir, "final.mp4");
  try {
    await assembleVideo({ ...input, outputPath });
    return await readFile(outputPath);
  } finally {
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
