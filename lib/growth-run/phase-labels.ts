export const GROWTH_RUN_PHASES = [
  "brief",
  "videotrend",
  "strategy",
  "loadout",
  "concepts",
  "scripts",
  "storyboards",
  "assets",
  "videos",
  "captions",
  "approval",
] as const;

export type GrowthRunPhase = (typeof GROWTH_RUN_PHASES)[number];

export const GROWTH_RUN_PHASE_LABELS: Record<GrowthRunPhase, string> = {
  brief: "Loading product brief",
  videotrend: "Analyzing video trends in your niche",
  strategy: "Building video strategy",
  loadout: "Planning posting loadout",
  concepts: "Generating video concepts",
  scripts: "Writing scripts",
  storyboards: "Storyboarding scenes",
  assets: "Preparing visual assets",
  videos: "Rendering videos",
  captions: "Adding captions",
  approval: "Ready for review",
};

export function growthPhaseMessage(
  phase: string,
  phaseStatus: Record<string, unknown>
): string {
  const label = GROWTH_RUN_PHASE_LABELS[phase as GrowthRunPhase] ?? phase;
  const entry = phaseStatus[phase] as { status?: string; count?: number; structures?: number } | undefined;
  if (entry?.status === "running" || !entry?.status) return `${label}…`;
  if (entry.status === "failed") return `${label} failed`;
  if (phase === "concepts" && typeof entry.count === "number") {
    return `Generated ${entry.count} video concept${entry.count === 1 ? "" : "s"}`;
  }
  if (phase === "videotrend" && typeof entry.structures === "number") {
    return `Found ${entry.structures} winning structure${entry.structures === 1 ? "" : "s"}`;
  }
  if (phase === "videos" && typeof entry.count === "number") {
    return `Rendered ${entry.count} video${entry.count === 1 ? "" : "s"}`;
  }
  return `${label} complete`;
}
