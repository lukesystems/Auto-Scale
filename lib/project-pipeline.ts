export interface PipelineStep {
  key: string;
  done: boolean;
}

export function buildPipelineSteps(
  stats: {
    sourceCount: number;
    insightCount: number;
    ideaCount: number;
    postCount: number;
    approvedCount: number;
    scheduledCount: number;
    experimentCount: number;
    winnerCount: number;
  },
  briefComplete: boolean
): PipelineStep[] {
  return [
    { key: "overview", done: true },
    { key: "brief", done: briefComplete },
    { key: "sources", done: stats.sourceCount > 0 },
    { key: "trendwatch", done: stats.insightCount > 0 },
    { key: "ideas", done: stats.ideaCount > 0 },
    { key: "content", done: stats.postCount > 0 },
    { key: "approval", done: stats.approvedCount > 0 },
    { key: "exports", done: stats.approvedCount > 0 },
    { key: "schedule", done: stats.scheduledCount > 0 },
    { key: "experiments", done: stats.experimentCount > 0 },
    { key: "winners", done: stats.winnerCount > 0 },
  ];
}
