import "server-only";

import { getPublishingProviderId } from "@/services/social-publishing";
import { instagramMetricsAdapter } from "./instagram-adapter";
import { postBridgeMetricsAdapter } from "./postbridge-adapter";
import { tiktokMetricsAdapter } from "./tiktok-adapter";
import type { MetricsAdapter } from "./types";
import { youtubeMetricsAdapter } from "./youtube-adapter";

const PLATFORM_STUBS: MetricsAdapter[] = [
  tiktokMetricsAdapter,
  instagramMetricsAdapter,
  youtubeMetricsAdapter,
];

export function getMetricsAdapter(
  platform: string,
  providerId: string = getPublishingProviderId()
): MetricsAdapter {
  if (providerId === "postbridge") {
    return postBridgeMetricsAdapter;
  }

  const stub = PLATFORM_STUBS.find((adapter) => adapter.supports(platform));
  return stub ?? tiktokMetricsAdapter;
}

export { postBridgeMetricsAdapter } from "./postbridge-adapter";
export { mapPostBridgeAnalyticsToSnapshot } from "./postbridge-map";
export type {
  MetricsAdapter,
  MetricsCredentials,
  MetricsFetchInput,
  MetricsFetchResult,
  MetricsSnapshot,
  IngestionRunSummary,
  ScheduleItemIngestionResult,
} from "./types";
