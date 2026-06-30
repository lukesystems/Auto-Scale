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
  /** ASS subtitles for kinetic burn-in (preferred over SRT when set). */
  assSubtitlesPath?: string;
  backgroundMusicPath?: string;
  backgroundMusicVolume?: number;
  /** When true, duck music under voiceover via sidechain compression. */
  duckMusicUnderVoice?: boolean;
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
          "medium",
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
          "medium",
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
    if (input.backgroundMusicPath) {
      args.push("-stream_loop", "-1", "-i", input.backgroundMusicPath);
    }
    if (input.voiceoverPath) {
      args.push("-i", input.voiceoverPath);
    }

    const filters: string[] = [];
    let videoOut = "0:v";
    const subPath = input.assSubtitlesPath ?? input.subtitlesPath;
    if (subPath) {
      const escaped = subPath.replace(/\\/g, "/").replace(/:/g, "\\:");
      const isAss = subPath.toLowerCase().endsWith(".ass");
      filters.push(
        isAss
          ? `[0:v]ass='${escaped}'[vout]`
          : `[0:v]subtitles='${escaped}'[vout]`
      );
      videoOut = "[vout]";
    }

    if (input.backgroundMusicPath && input.voiceoverPath) {
      const musicVol = input.backgroundMusicVolume ?? 0.12;
      if (input.duckMusicUnderVoice) {
        filters.push(
          `[1:a]volume=${musicVol}[bg];[2:a]asplit=2[vo][sc];[bg][sc]sidechaincompress=threshold=0.03:ratio=6:attack=200:release=800[ducked];[vo][ducked]amix=inputs=2:duration=shortest:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`
        );
      } else {
        filters.push(
          `[1:a]volume=${musicVol}[bg];[2:a][bg]amix=inputs=2:duration=shortest:dropout_transition=2,loudnorm=I=-16:TP=-1.5:LRA=11[aout]`
        );
      }
    } else if (input.backgroundMusicPath) {
      const musicVol = input.backgroundMusicVolume ?? 0.2;
      filters.push(`[1:a]volume=${musicVol},loudnorm=I=-16:TP=-1.5:LRA=11[aout]`);
    }

    if (filters.length) {
      args.push("-filter_complex", filters.join(";"));
      args.push("-map", videoOut);
      if (input.backgroundMusicPath && input.voiceoverPath) {
        args.push("-map", "[aout]");
      } else if (input.backgroundMusicPath) {
        args.push("-map", "[aout]");
      } else if (input.voiceoverPath) {
        args.push("-map", "1:a");
      }
    } else {
      args.push("-map", "0:v");
      if (input.voiceoverPath) {
        args.push("-map", "1:a");
      }
    }

    if (input.voiceoverPath || input.backgroundMusicPath) {
      args.push("-c:a", "aac", "-b:a", "192k", "-shortest");
    }

    args.push(
      "-c:v",
      "libx264",
      "-preset",
      "medium",
      "-crf",
      "20",
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
