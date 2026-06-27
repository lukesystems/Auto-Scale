import "server-only";

import {
  extractPostBridgePostResultId,
  fetchPostBridgeAnalytics,
  getPostBridgePost,
  syncPostBridgeAnalytics,
  type PostBridgeCredentials,
} from "@/services/postbridge/client";
import { mapPostBridgeAnalyticsToSnapshot } from "./postbridge-map";
import { computeEngagementRate } from "./engagement";
import type {
  MetricsAdapter,
  MetricsCredentials,
  MetricsFetchInput,
  MetricsFetchResult,
  MetricsSnapshot,
} from "./types";

export { mapPostBridgeAnalyticsToSnapshot } from "./postbridge-map";

function toPostBridgeCredentials(credentials: MetricsCredentials): PostBridgeCredentials {
  return { apiKey: credentials.apiKey, apiUrl: credentials.apiUrl };
}

function pickNumber(...values: Array<unknown>): number | null {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
    if (typeof value === "string" && value.trim() && !Number.isNaN(Number(value))) {
      return Number(value);
    }
  }
  return null;
}

function normalizeUrl(url: string | null | undefined): string | null {
  if (!url?.trim()) return null;
  try {
    const parsed = new URL(url.trim());
    return `${parsed.origin}${parsed.pathname}`.replace(/\/$/, "");
  } catch {
    return url.trim().replace(/\/$/, "");
  }
}

function selectAnalyticsRecord(
  records: Record<string, unknown>[],
  opts: { postResultId?: string | null; postedUrl?: string | null; remotePostId: string }
): Record<string, unknown> | null {
  if (!records.length) return null;

  if (opts.postResultId) {
    const byResult = records.find((row) => {
      const id = row.post_result_id ?? row.id;
      return id != null && String(id) === opts.postResultId;
    });
    if (byResult) return byResult;
  }

  const normalizedPosted = normalizeUrl(opts.postedUrl);
  if (normalizedPosted) {
    const byUrl = records.find((row) => {
      const shareUrl = normalizeUrl(
        typeof row.share_url === "string" ? row.share_url : null
      );
      return shareUrl && shareUrl === normalizedPosted;
    });
    if (byUrl) return byUrl;
  }

  const byPostId = records.find((row) => {
    const postId = row.post_id ?? row.postId;
    return postId != null && String(postId) === opts.remotePostId;
  });
  if (byPostId) return byPostId;

  return records[0] ?? null;
}

function metricsFromPostPayload(post: Record<string, unknown>): MetricsSnapshot | null {
  const metrics =
    post.metrics && typeof post.metrics === "object"
      ? (post.metrics as Record<string, unknown>)
      : null;

  const views = pickNumber(post.view_count, post.views, metrics?.view_count, metrics?.views);
  const likes = pickNumber(post.like_count, post.likes, metrics?.like_count, metrics?.likes);
  const comments = pickNumber(
    post.comment_count,
    post.comments,
    metrics?.comment_count,
    metrics?.comments
  );
  const shares = pickNumber(post.share_count, post.shares, metrics?.share_count, metrics?.shares);
  const saves = pickNumber(post.save_count, post.saves, metrics?.save_count, metrics?.saves);

  if (views == null && likes == null && comments == null && shares == null && saves == null) {
    return null;
  }

  const impressions = pickNumber(post.impression_count, post.impressions);
  const watchTimeSeconds = pickNumber(
    post.watch_time_seconds,
    post.average_watch_time_seconds,
    post.duration
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
    raw: { post_payload: post },
  };
}

export const postBridgeMetricsAdapter: MetricsAdapter = {
  name: "postbridge",

  supports(platform: string) {
    return ["tiktok", "instagram", "youtube", "facebook", "linkedin", "pinterest", "threads"].includes(
      platform.toLowerCase()
    );
  },

  async fetchMetrics(
    input: MetricsFetchInput,
    credentials: MetricsCredentials
  ): Promise<MetricsFetchResult> {
    if (!credentials.apiKey?.trim()) {
      return { ok: false, supported: true, reason: "Post Bridge API key is not configured." };
    }

    const creds = toPostBridgeCredentials(credentials);
    const platform = input.platform.toLowerCase();

    // Best-effort sync; ignore rate-limit failures.
    try {
      await syncPostBridgeAnalytics(creds, platform);
    } catch {
      // non-fatal
    }

    const post = await getPostBridgePost(creds, input.remotePostId);
    const postResultId = post ? extractPostBridgePostResultId(post, platform) : null;

    if (post) {
      const embedded = metricsFromPostPayload(post);
      if (embedded && (embedded.views != null || embedded.likes != null)) {
        return { ok: true, snapshot: embedded };
      }
    }

    const analytics = await fetchPostBridgeAnalytics(creds, {
      platform,
      postResultId: postResultId ?? undefined,
      timeframe: "30d",
      limit: 25,
    });

    if (!analytics.ok) {
      // Analytics endpoint may be unavailable for some platforms — fall back to post payload.
      if (post) {
        const fallback = metricsFromPostPayload(post);
        if (fallback) return { ok: true, snapshot: fallback };
      }
      return {
        ok: false,
        supported: analytics.error?.includes("404") ? false : true,
        reason: analytics.error ?? "Post Bridge analytics request failed.",
      };
    }

    const record = selectAnalyticsRecord(analytics.records, {
      postResultId,
      postedUrl: input.postedUrl,
      remotePostId: input.remotePostId,
    });

    if (!record) {
      if (post) {
        const fallback = metricsFromPostPayload(post);
        if (fallback) return { ok: true, snapshot: fallback };
      }
      return {
        ok: false,
        supported: true,
        reason:
          "Post Bridge returned no analytics records for this post yet. Metrics may appear after the post is live and synced.",
      };
    }

    return {
      ok: true,
      snapshot: mapPostBridgeAnalyticsToSnapshot(record, analytics.raw),
    };
  },
};
