export interface PipelineStep {
  key: string;
  done: boolean;
}

export interface ProjectPipelineStats {
  sourceCount: number;
  insightCount: number;
  ideaCount: number;
  postCount: number;
  approvedCount: number;
  scheduledCount: number;
  experimentCount: number;
  winnerCount: number;
  growthRunCompletedCount: number;
  growthVideoReadyCount: number;
  growthScheduledCount: number;
  growthPostedCount: number;
  videoEvidenceCount: number;
  patternRunCount: number;
  dailyPackCount: number;
}

/**
 * Pivot note: Growth Run is the sole loop. The pipeline now reflects the
 * Brief → Sources → Video Intelligence → First Growth Run → Winners detected
 * → Compounding variants progression.
 */
export function buildPipelineSteps(
  stats: ProjectPipelineStats,
  briefComplete: boolean
): PipelineStep[] {
  return [
    { key: "overview", done: true },
    { key: "brief", done: briefComplete },
    { key: "sources", done: stats.sourceCount > 0 },
    { key: "video-intelligence", done: stats.videoEvidenceCount > 0 },
    { key: "growth", done: stats.growthRunCompletedCount > 0 || stats.growthVideoReadyCount > 0 || stats.growthScheduledCount > 0 },
    { key: "daily-growth", done: stats.dailyPackCount > 0 },
    { key: "winners", done: stats.winnerCount > 0 },
    { key: "variants", done: stats.winnerCount > 1 || stats.growthRunCompletedCount > 1 },
  ];
}
