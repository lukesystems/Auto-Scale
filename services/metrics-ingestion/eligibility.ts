const DEFAULT_WINDOW_DAYS = 30;

export type ScheduleItemRow = {
  id: string;
  project_id: string;
  growth_run_id: string;
  video_id: string;
  platform: string;
  status: string;
  postbridge_post_id: string | null;
  posted_url: string | null;
  posted_at: string | null;
  scheduled_for: string;
};

export function windowStartIso(sinceDays: number): string {
  const start = new Date();
  start.setDate(start.getDate() - sinceDays);
  return start.toISOString();
}

export function isWithinMetricsWindow(item: ScheduleItemRow, sinceDays: number): boolean {
  const anchor = item.posted_at ?? item.scheduled_for;
  if (!anchor) return false;
  return new Date(anchor).getTime() >= new Date(windowStartIso(sinceDays)).getTime();
}

export function selectEligibleScheduleItems(
  items: ScheduleItemRow[],
  sinceDays: number = DEFAULT_WINDOW_DAYS
): ScheduleItemRow[] {
  return items.filter(
    (item) =>
      item.status === "posted" &&
      Boolean(item.postbridge_post_id) &&
      isWithinMetricsWindow(item, sinceDays)
  );
}
