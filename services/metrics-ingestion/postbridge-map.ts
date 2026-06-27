import { computeEngagementRate } from "./engagement";
import { PostBridgeAnalyticsRecordSchema } from "./schema";
import type { MetricsSnapshot } from "./types";

function pickNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

/** Maps a Post Bridge analytics record to MetricsSnapshot. */
export function mapPostBridgeAnalyticsToSnapshot(
  record: Record<string, unknown>,
  rawPayload: unknown
): MetricsSnapshot {
  const parsed = PostBridgeAnalyticsRecordSchema.safeParse(record);
  const row = parsed.success ? parsed.data : record;

  const views = pickNumber(row.view_count, row.views);
  const likes = pickNumber(row.like_count, row.likes);
  const comments = pickNumber(row.comment_count, row.comments);
  const shares = pickNumber(row.share_count, row.shares);
  const saves = pickNumber(row.save_count, row.saves);
  const impressions = pickNumber(row.impression_count, row.impressions);
  const watchTimeSeconds = pickNumber(
    row.watch_time_seconds,
    row.average_watch_time_seconds,
    row.duration
  );

  return {
    fetchedAt: new Date().toISOString(),
    source: "postbridge",
    views,
    likes,
    comments,
    shares,
    saves,
    watchTimeSeconds,
    impressions,
    engagementRate: computeEngagementRate({ views, likes, comments, shares, saves }),
    raw: {
      analytics_record: record,
      response: rawPayload,
    },
  };
}
