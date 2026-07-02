import { z } from "zod";

/** Post Bridge GET /v1/analytics record (field names vary by platform). */
export const PostBridgeAnalyticsRecordSchema = z
  .object({
    id: z.union([z.string(), z.number()]).optional(),
    post_result_id: z.union([z.string(), z.number()]).optional(),
    post_id: z.union([z.string(), z.number()]).optional(),
    platform: z.string().optional(),
    view_count: z.number().nullable().optional(),
    views: z.number().nullable().optional(),
    like_count: z.number().nullable().optional(),
    likes: z.number().nullable().optional(),
    comment_count: z.number().nullable().optional(),
    comments: z.number().nullable().optional(),
    share_count: z.number().nullable().optional(),
    shares: z.number().nullable().optional(),
    save_count: z.number().nullable().optional(),
    saves: z.number().nullable().optional(),
    impression_count: z.number().nullable().optional(),
    impressions: z.number().nullable().optional(),
    watch_time_seconds: z.number().nullable().optional(),
    average_watch_time_seconds: z.number().nullable().optional(),
    duration: z.number().nullable().optional(),
    share_url: z.string().nullable().optional(),
    cover_image_url: z.string().nullable().optional(),
  })
  .passthrough();

export const PostBridgeAnalyticsResponseSchema = z.object({
  data: z.array(PostBridgeAnalyticsRecordSchema).optional(),
});

export type PostBridgeAnalyticsRecord = z.infer<typeof PostBridgeAnalyticsRecordSchema>;
