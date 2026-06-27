export interface MetricsSnapshot {
  fetchedAt: string;
  source: "postbridge" | "manual" | "tiktok" | "instagram" | "youtube";
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  saves: number | null;
  watchTimeSeconds: number | null;
  impressions: number | null;
  engagementRate: number | null;
  raw: Record<string, unknown>;
}

export interface MetricsFetchInput {
  remotePostId: string;
  postedUrl?: string | null;
  platform: string;
  scheduleItemId?: string;
  videoId?: string;
  projectId: string;
}

export interface MetricsCredentials {
  apiKey: string;
  apiUrl?: string | null;
}

export interface MetricsAdapter {
  name: string;
  supports(platform: string): boolean;
  fetchMetrics(
    input: MetricsFetchInput,
    credentials: MetricsCredentials
  ): Promise<MetricsFetchResult>;
}

export type MetricsFetchResult =
  | { ok: true; snapshot: MetricsSnapshot }
  | { ok: false; supported: boolean; reason: string };

export interface IngestionRunSummary {
  projectId: string;
  checked: number;
  ingested: number;
  skipped: number;
  errors: string[];
}

export interface ScheduleItemIngestionResult {
  scheduleItemId: string;
  ok: boolean;
  snapshotId?: string;
  reason?: string;
}
