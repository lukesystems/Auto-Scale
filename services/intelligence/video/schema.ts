import { z } from "zod";

export const VideoPlatformSchema = z.enum(["tiktok", "instagram", "youtube", "other"]);
export const VideoSourceTypeSchema = z.enum(["video", "profile", "unknown"]);

export const VideoEvidenceSchema = z.object({
  projectId: z.string().uuid().nullable().default(null),
  competitorId: z.string().uuid().nullable().default(null),
  sourceCandidateId: z.string().uuid().nullable().default(null),
  platform: VideoPlatformSchema,
  videoUrl: z.string().url(),
  canonicalUrl: z.string().url(),
  accountHandle: z.string().nullable().default(null),
  accountUrl: z.string().url().nullable().default(null),
  caption: z.string().nullable().default(null),
  title: z.string().nullable().default(null),
  hashtags: z.array(z.string()).default([]),
  sound: z.string().nullable().default(null),
  durationSeconds: z.number().int().nonnegative().nullable().default(null),
  viewCount: z.number().int().nonnegative().nullable().default(null),
  likeCount: z.number().int().nonnegative().nullable().default(null),
  commentCount: z.number().int().nonnegative().nullable().default(null),
  shareCount: z.number().int().nonnegative().nullable().default(null),
  postedAt: z.string().datetime().nullable().default(null),
  linkedUrls: z.array(z.string().url()).default([]),
  detectedHook: z.string().nullable().default(null),
  detectedCTA: z.string().nullable().default(null),
  formatGuess: z.enum([
    "tutorial", "demo", "before_after", "founder_story", "comparison", "reaction",
    "listicle", "teardown", "transformation", "product_showcase", "unknown",
  ]).default("unknown"),
  topicGuess: z.string().nullable().default(null),
  sourceConfidence: z.number().min(0).max(1).default(0),
  fetchStatus: z.enum(["pending", "success", "failed", "skipped"]),
  fetchMethod: z.string(),
  rawSourceType: VideoSourceTypeSchema,
  metadata: z.record(z.unknown()).default({}),
});

export type VideoEvidence = z.infer<typeof VideoEvidenceSchema>;
export type VideoPlatform = z.infer<typeof VideoPlatformSchema>;
export type VideoSourceType = z.infer<typeof VideoSourceTypeSchema>;
