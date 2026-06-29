export type GrowthRunStageId = 1 | 2 | 3 | 4;

export interface GrowthRunStageDefinition {
  id: GrowthRunStageId;
  key: string;
  title: string;
  rangeLabel: string;
  phases: readonly string[];
  boundaryPhase: string;
  continueCta: string;
}

export const GROWTH_RUN_STAGES: readonly GrowthRunStageDefinition[] = [
  {
    id: 1,
    key: "setup",
    title: "Setup & Understanding",
    rangeLabel: "Understanding your product through Analyzing video trends in your niche",
    phases: [
      "autobrief",
      "deep_discovery",
      "video_discovery",
      "pattern_mining",
      "trendhop",
      "videotrend",
    ],
    boundaryPhase: "videotrend",
    continueCta: "Continue to Strategy & Scripts",
  },
  {
    id: 2,
    key: "strategy",
    title: "Strategy & Creative",
    rangeLabel: "Building video strategy through Storyboarding scenes",
    phases: ["strategy", "loadout", "concepts", "scripts", "storyboards"],
    boundaryPhase: "storyboards",
    continueCta: "Generate Videos",
  },
  {
    id: 3,
    key: "production",
    title: "Video Production",
    rangeLabel: "Preparing visual assets through Ready for review",
    phases: ["assets", "videos", "captions", "approval"],
    boundaryPhase: "approval",
    continueCta: "Schedule & Post",
  },
  {
    id: 4,
    key: "distribution",
    title: "Distribution",
    rangeLabel: "Scheduling and posting via post-bridge",
    phases: ["schedule"],
    boundaryPhase: "schedule",
    continueCta: "Schedule via Post Bridge",
  },
] as const;

export const STAGE_BOUNDARY_PHASES = new Set(
  GROWTH_RUN_STAGES.map((s) => s.boundaryPhase)
);

export function getStageById(id: number): GrowthRunStageDefinition | undefined {
  return GROWTH_RUN_STAGES.find((s) => s.id === id);
}

export function getStageForPhase(phase: string): GrowthRunStageDefinition | undefined {
  return GROWTH_RUN_STAGES.find((s) =>
    (s.phases as readonly string[]).includes(phase)
  );
}

export function getStageByBoundaryPhase(
  boundaryPhase: string
): GrowthRunStageDefinition | undefined {
  return GROWTH_RUN_STAGES.find((s) => s.boundaryPhase === boundaryPhase);
}

export function getNextStageCta(boundaryPhase: string | null): string {
  const stage = boundaryPhase ? getStageByBoundaryPhase(boundaryPhase) : undefined;
  return stage?.continueCta ?? "Continue run";
}

/** Infer macro stage for legacy runs missing `current_stage`. */
export function resolveRunStage(input: {
  current_stage?: number | null;
  paused_at_phase?: string | null;
  phase?: string | null;
  status?: string | null;
}): GrowthRunStageId {
  if (
    typeof input.current_stage === "number" &&
    input.current_stage >= 1 &&
    input.current_stage <= 4
  ) {
    return input.current_stage as GrowthRunStageId;
  }

  const boundary = input.paused_at_phase ?? input.phase ?? "";
  const byBoundary = getStageByBoundaryPhase(boundary);
  if (byBoundary && input.status === "awaiting_user_input") {
    return byBoundary.id;
  }

  const byPhase = getStageForPhase(boundary);
  if (byPhase) return byPhase.id;

  if (input.status === "live" || input.status === "scheduled") return 4;
  if (input.phase === "schedule") return 4;

  return 1;
}

export function isStageBoundaryPause(pausedAtPhase: string | null): boolean {
  return Boolean(pausedAtPhase && STAGE_BOUNDARY_PHASES.has(pausedAtPhase));
}
