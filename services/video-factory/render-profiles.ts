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
}

export const RENDER_PROFILES: Record<PlatformProfile, RenderProfile> = {
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
    exportPreset: "h264_aac_30fps",
    fileNamePrefix: "tiktok",
  },
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
    exportPreset: "h264_aac_30fps",
    fileNamePrefix: "reels",
  },
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
    exportPreset: "h264_aac_30fps",
    fileNamePrefix: "shorts",
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
