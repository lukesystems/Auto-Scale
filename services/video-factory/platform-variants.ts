import "server-only";

import { writeFile } from "node:fs/promises";
import { join } from "node:path";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getRenderProfile, type PlatformProfile } from "./render-profiles";
import { assembleVideoToBuffer, type SceneClipInput } from "./assembler";
import { uploadGrowthMedia } from "./storage";
import { formatAssCaptions } from "./captions/export-ass";
import type { CaptionPage } from "./captions/paging";

type Client = SupabaseClient<Database>;

const PLATFORM_TO_PROFILE: Record<string, PlatformProfile> = {
  tiktok: "tiktok",
  instagram: "instagram_reels",
  youtube: "youtube_shorts",
};

/**
 * Inputs needed to re-run the final ffmpeg assembly per platform. When
 * provided, each platform gets a genuinely distinct encode (duration cap,
 * caption safe-zone margin, bitrate/preset) instead of re-uploading the same
 * buffer. When omitted, callers that don't have scene data on hand fall back
 * to re-uploading `mp4Buffer` as-is (legacy behavior).
 */
export interface PlatformRenderInputs {
  scenes: SceneClipInput[];
  voiceoverPath?: string;
  /** Plain SRT to burn in when no caption pages are available. */
  fallbackSrtPath?: string;
  /** Timed caption pages, re-rendered to ASS per platform with that platform's safe-zone margin. */
  captionPages?: CaptionPage[];
  karaoke?: boolean;
  backgroundMusicPath?: string;
  backgroundMusicVolume?: number;
  duckMusicUnderVoice?: boolean;
  /** Scratch directory (caller owns cleanup) to write per-platform caption files into. */
  workDir: string;
}

export async function upsertPlatformVariants(opts: {
  client: Client;
  projectId: string;
  growthRunId: string;
  videoId: string;
  conceptId: string;
  platform: string;
  mp4Buffer: Buffer;
  durationSeconds: number;
  targetPlatforms?: string[];
  renderInputs?: PlatformRenderInputs;
}): Promise<void> {
  const platforms =
    opts.targetPlatforms?.length
      ? opts.targetPlatforms
      : [opts.platform];

  const uniquePlatforms = [...new Set(platforms)];

  for (const p of uniquePlatforms) {
    const profileKey = PLATFORM_TO_PROFILE[p] ?? "tiktok";
    const profile = getRenderProfile(p);

    const { data: variantRow } = await opts.client
      .from("platform_video_variants")
      .upsert(
        {
          project_id: opts.projectId,
          growth_run_id: opts.growthRunId,
          video_id: opts.videoId,
          concept_id: opts.conceptId,
          platform: p as "tiktok" | "instagram" | "youtube",
          render_profile: profileKey,
          duration_seconds: Math.min(opts.durationSeconds, profile.maxDurationSeconds),
          width: profile.width,
          height: profile.height,
          status: "rendering",
        } as never,
        { onConflict: "video_id,platform" }
      )
      .select("id")
      .single();

    // Re-assemble a platform-specific encode when we have the source
    // materials (scenes/voiceover/captions); otherwise fall back to
    // re-uploading the already-assembled buffer as-is.
    let variantBuffer = opts.mp4Buffer;
    if (opts.renderInputs) {
      const ri = opts.renderInputs;
      let assSubtitlesPath: string | undefined;
      if (ri.captionPages?.length) {
        const ass = formatAssCaptions(ri.captionPages, {
          width: profile.width,
          height: profile.height,
          marginV: profile.captionSafeZone.bottom,
          karaoke: ri.karaoke,
        });
        assSubtitlesPath = join(ri.workDir, `subs-${p}.ass`);
        await writeFile(assSubtitlesPath, ass, "utf8");
      }

      variantBuffer = await assembleVideoToBuffer({
        scenes: ri.scenes,
        voiceoverPath: ri.voiceoverPath,
        subtitlesPath: ri.fallbackSrtPath,
        assSubtitlesPath,
        backgroundMusicPath: ri.backgroundMusicPath,
        backgroundMusicVolume: ri.backgroundMusicVolume,
        duckMusicUnderVoice: ri.duckMusicUnderVoice,
        width: profile.width,
        height: profile.height,
        maxDurationSeconds: profile.maxDurationSeconds,
        crf: profile.crf,
        preset: profile.ffmpegPreset,
        audioBitrateKbps: profile.audioBitrateKbps,
      });
    }

    const { storagePath, publicUrl } = await uploadGrowthMedia({
      projectId: opts.projectId,
      growthRunId: opts.growthRunId,
      conceptId: opts.conceptId,
      filename: `${profile.fileNamePrefix}-final.mp4`,
      body: variantBuffer,
      contentType: "video/mp4",
    });

    const { data: asset } = await opts.client
      .from("generated_assets")
      .insert({
        project_id: opts.projectId,
        growth_run_id: opts.growthRunId,
        concept_id: opts.conceptId,
        kind: "final_mp4",
        provider: "ffmpeg",
        storage_path: storagePath,
        public_url: publicUrl,
        duration_seconds: Math.min(opts.durationSeconds, profile.maxDurationSeconds),
        status: "succeeded",
        metadata: { platform: p, render_profile: profileKey },
      } as never)
      .select("id")
      .single();

    await opts.client
      .from("platform_video_variants")
      .update({
        final_asset_id: asset?.id ?? null,
        public_url: publicUrl,
        status: "ready",
      } as never)
      .eq("id", variantRow?.id ?? "");
  }
}

export async function getPlatformVariantUrl(
  client: Client,
  videoId: string,
  platform: string
): Promise<string | null> {
  const { data } = await client
    .from("platform_video_variants")
    .select("public_url, status")
    .eq("video_id", videoId)
    .eq("platform", platform as "tiktok" | "instagram" | "youtube")
    .maybeSingle();
  if (data?.status === "ready" && data.public_url) return data.public_url;
  return null;
}
