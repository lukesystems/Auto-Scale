import { z } from "zod";

export const PLATFORM_PROFILES = ["tiktok", "instagram_reels", "youtube_shorts"] as const;
export type PlatformProfile = (typeof PLATFORM_PROFILES)[number];

export const PlatformProfileSchema = z.enum(PLATFORM_PROFILES);

export interface RenderProfile {
  id: PlatformProfile;
  label: string;
  platform: "tiktok" | "instagram" | "youtube";
  aspectRatio: string;
  width: number;
  height: number;
  maxDurationSeconds: number;
  targetDurationSeconds: number;
  captionSafeZone: { top: number; bottom: number; side: number };
  ctaSafeZone: { bottom: number; height: number };
  exportPreset: string;
  fileNamePrefix: string;
  /** libx264 -crf value for the final encode. Lower = higher quality/bigger file. */
  crf: number;
  /** libx264 -preset (encode speed vs. compression efficiency). */
  ffmpegPreset: string;
  /** AAC audio bitrate in kbps for the final encode. */
  audioBitrateKbps: number;
}

export const RENDER_PROFILES: Record<PlatformProfile, RenderProfile> = {
  // TikTok re-transcodes almost everything it receives, so we bias toward a
  // smaller, faster encode (its own pipeline recompresses anyway) and give
  // captions extra bottom clearance for the caption/CTA sticker tray.
  tiktok: {
    id: "tiktok",
    label: "TikTok",
    platform: "tiktok",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    maxDurationSeconds: 60,
    targetDurationSeconds: 22,
    captionSafeZone: { top: 180, bottom: 280, side: 108 },
    ctaSafeZone: { bottom: 320, height: 200 },
    exportPreset: "h264_aac_30fps_tiktok",
    fileNamePrefix: "tiktok",
    crf: 22,
    ffmpegPreset: "fast",
    audioBitrateKbps: 128,
  },
  // Instagram preserves more of the source bitrate than TikTok, allows the
  // longest Reels runtime of the three, and reserves less bottom margin
  // since Reels UI chrome sits closer to the edge.
  instagram_reels: {
    id: "instagram_reels",
    label: "Instagram Reels",
    platform: "instagram",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    maxDurationSeconds: 90,
    targetDurationSeconds: 24,
    captionSafeZone: { top: 200, bottom: 300, side: 96 },
    ctaSafeZone: { bottom: 340, height: 180 },
    exportPreset: "h264_aac_30fps_reels",
    fileNamePrefix: "reels",
    crf: 20,
    ffmpegPreset: "medium",
    audioBitrateKbps: 160,
  },
  // YouTube Shorts tolerates (and rewards) the highest source quality since
  // YouTube's transcoder ladder starts from a better master; use the
  // slowest/highest-quality encode of the three and the tightest safe zone
  // since the Shorts shelf UI covers less of the frame.
  youtube_shorts: {
    id: "youtube_shorts",
    label: "YouTube Shorts",
    platform: "youtube",
    aspectRatio: "9:16",
    width: 1080,
    height: 1920,
    maxDurationSeconds: 60,
    targetDurationSeconds: 28,
    captionSafeZone: { top: 160, bottom: 260, side: 108 },
    ctaSafeZone: { bottom: 300, height: 200 },
    exportPreset: "h264_aac_30fps_shorts",
    fileNamePrefix: "shorts",
    crf: 18,
    ffmpegPreset: "slow",
    audioBitrateKbps: 192,
  },
};

export function resolvePlatformProfile(platform: string): PlatformProfile {
  if (platform === "instagram") return "instagram_reels";
  if (platform === "youtube") return "youtube_shorts";
  return "tiktok";
}

export function getRenderProfile(platformOrProfile: string): RenderProfile {
  if (platformOrProfile in RENDER_PROFILES) {
    return RENDER_PROFILES[platformOrProfile as PlatformProfile];
  }
  return RENDER_PROFILES[resolvePlatformProfile(platformOrProfile)];
}
