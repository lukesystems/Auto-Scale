export function computeEngagementRate(metrics: {
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
}): number | null {
  if (metrics.views == null || metrics.views <= 0) return null;
  const engagements =
    (metrics.likes ?? 0) +
    (metrics.comments ?? 0) +
    (metrics.shares ?? 0) +
    (metrics.saves ?? 0);
  if (engagements <= 0) return 0;
  return engagements / metrics.views;
}
