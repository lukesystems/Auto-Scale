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
  activeRunCount?: number;
}

/**
 * Unified AutoScale flow: pipeline reflects run progress, not separate panels.
 */
export function buildPipelineSteps(
  stats: ProjectPipelineStats,
  hasActiveRun: boolean
): PipelineStep[] {
  const runStarted =
    hasActiveRun ||
    stats.growthRunCompletedCount > 0 ||
    stats.growthVideoReadyCount > 0 ||
    stats.growthScheduledCount > 0;

  return [
    { key: "overview", done: true },
    { key: "growth", done: runStarted },
    { key: "daily-growth", done: stats.dailyPackCount > 0 },
    { key: "growth-results", done: stats.growthScheduledCount > 0 || stats.growthPostedCount > 0 },
    { key: "winners", done: stats.winnerCount > 0 },
    { key: "variants", done: stats.winnerCount > 1 || stats.growthRunCompletedCount > 1 },
  ];
}
