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
  /** libx264 -crf for the final encode (lower = higher quality). Default 20. */
  crf?: number;
  /** libx264 -preset for the final encode. Default "medium". */
  preset?: string;
  /** AAC audio bitrate in kbps for the final encode. Default 192. */
  audioBitrateKbps?: number;
  /** Hard-trim the final output to at most this many seconds (platform max duration). */
  maxDurationSeconds?: number;
}

/**
 * Chain consecutive clips together with an `xfade` crossfade transition
 * between each pair, producing a single output clip. Video-only (source
 * clips have no audio at this stage — see the per-scene pre-render step).
 *
 * xfade's `offset` is the timestamp (within the *already-merged* stream)
 * at which each transition begins. For a chain of N clips with per-clip
 * durations d0..dN-1 and a fixed crossfade length c:
 *   offset_1 = d0 - c
 *   mergedDuration_1 = d0 + d1 - c
 *   offset_2 = mergedDuration_1 - c = d0 + d1 - 2c
 *   ...and so on, tracked incrementally below.
 */
async function buildCrossfadeChain(
  paths: string[],
  durationsSeconds: number[],
  crossfadeDurationSeconds: number,
  outPath: string
): Promise<void> {
  const args: string[] = [];
  for (const p of paths) {
    args.push("-i", p);
  }

  const filterParts: string[] = [];
  let currentLabel = "0:v";
  let mergedDuration = durationsSeconds[0] ?? 0;
  for (let k = 1; k < paths.length; k++) {
    const offset = Math.max(0, mergedDuration - crossfadeDurationSeconds);
    const outLabel = `vx${k}`;
    filterParts.push(
      `[${currentLabel}][${k}:v]xfade=transition=fade:duration=${crossfadeDurationSeconds}:offset=${offset.toFixed(3)}[${outLabel}]`
    );
    currentLabel = outLabel;
    mergedDuration = mergedDuration + (durationsSeconds[k] ?? 0) - crossfadeDurationSeconds;
  }

  args.push("-filter_complex", filterParts.join(";"));
  args.push("-map", `[${currentLabel}]`);
  args.push(
    "-c:v",
    "libx264",
    "-preset",
    // Throwaway intermediate re-encoded again in the final mux pass.
    "veryfast",
    "-pix_fmt",
    "yuv420p",
    outPath
  );

  await runFfmpeg(args);
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
          // Throwaway pre-render: this file is only re-encoded again in the
          // final mux pass below, so encode quality here doesn't matter —
          // only speed. Final output quality is controlled by the mux pass.
          "veryfast",
          "-an",
          out,
        ]);
      } else {
        const frames = Math.max(1, Math.ceil(scene.durationSeconds * 30));
        const kenBurns = `zoompan=z='min(zoom+0.0008,1.12)':x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':d=${frames}:s=${width}x${height}:fps=30`;
        const vf = `scale=${width}:${height}:force_original_aspect_ratio=decrease,pad=${width}:${height}:(ow-iw)/2:(oh-ih)/2,${kenBurns},format=yuv420p`;
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
          // Same rationale: throwaway intermediate, speed over quality here.
          "veryfast",
          "-pix_fmt",
          "yuv420p",
          "-an",
          out,
        ]);
      }
      scenePaths.push(out);
    }

    // Group consecutive scenes into "runs" so we can crossfade within a run
    // of consecutive slide (kind: "image") scenes while keeping hard cuts
    // everywhere else (b-roll scenes, and slide/b-roll boundaries) — fast
    // cuts on b-roll are intentional for short-form retention pacing.
    const CROSSFADE_DURATION_SECONDS = 0.2;
    const segments: string[] = [];
    {
      let i = 0;
      while (i < scenePaths.length) {
        if (input.scenes[i].kind === "image") {
          let j = i;
          while (j + 1 < scenePaths.length && input.scenes[j + 1].kind === "image") j++;
          if (j > i) {
            const runPaths = scenePaths.slice(i, j + 1);
            const runDurations = input.scenes.slice(i, j + 1).map((s) => s.durationSeconds);
            const xfadeOut = join(dir, `xfade-${i}-${j}.mp4`);
            await buildCrossfadeChain(runPaths, runDurations, CROSSFADE_DURATION_SECONDS, xfadeOut);
            segments.push(xfadeOut);
          } else {
            segments.push(scenePaths[i]!);
          }
          i = j + 1;
        } else {
          segments.push(scenePaths[i]!);
          i++;
        }
      }
    }

    const listPath = join(dir, "concat.txt");
    await writeFile(
      listPath,
      segments.map((p) => `file '${p.replace(/'/g, "'\\''")}'`).join("\n")
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
      args.push("-c:a", "aac", "-b:a", `${input.audioBitrateKbps ?? 192}k`, "-shortest");
    }

    args.push(
      "-c:v",
      "libx264",
      "-preset",
      input.preset ?? "medium",
      "-crf",
      String(input.crf ?? 20),
      "-pix_fmt",
      "yuv420p",
      "-movflags",
      "+faststart"
    );

    if (input.maxDurationSeconds != null) {
      args.push("-t", String(input.maxDurationSeconds));
    }

    args.push(input.outputPath);

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
