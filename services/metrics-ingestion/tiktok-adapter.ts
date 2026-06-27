import type { MetricsAdapter, MetricsCredentials, MetricsFetchInput, MetricsFetchResult } from "./types";

const REASON = "Direct platform API not implemented; use Post Bridge adapter";

export const tiktokMetricsAdapter: MetricsAdapter = {
  name: "tiktok",
  supports(platform: string) {
    return platform.toLowerCase() === "tiktok";
  },
  async fetchMetrics(
    _input: MetricsFetchInput,
    _credentials: MetricsCredentials
  ): Promise<MetricsFetchResult> {
    return { ok: false, supported: false, reason: REASON };
  },
};
