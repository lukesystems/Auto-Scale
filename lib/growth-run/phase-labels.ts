import { GROWTH_RUN_STAGES } from "./stages";

export const GROWTH_RUN_PHASES = [
  "autobrief",
  "brief",
  "deep_discovery",
  "video_discovery",
  "pattern_mining",
  "trendhop",
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
  "schedule",
] as const;

export { GROWTH_RUN_STAGES };

export type GrowthRunPhase = (typeof GROWTH_RUN_PHASES)[number];

export const GROWTH_RUN_PHASE_LABELS: Record<string, string> = {
  autobrief: "Understanding your product",
  brief: "Loading product brief",
  deep_discovery: "Gathering niche evidence",
  video_discovery: "Discovering video signals",
  pattern_mining: "Mining competitor patterns",
  trendhop: "Scanning trending content",
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
  schedule: "Scheduling and posting",
};

/** Phases grouped under each macro-stage heading (for timeline UI). */
export const GROWTH_RUN_PHASES_BY_STAGE = GROWTH_RUN_STAGES.map((stage) => ({
  stageId: stage.id,
  title: stage.title,
  rangeLabel: stage.rangeLabel,
  phases: stage.phases.filter((p) => GROWTH_RUN_PHASES.includes(p as GrowthRunPhase)),
}));

export function growthPhaseMessage(
  phase: string,
  phaseStatus: Record<string, unknown>
): string {
  const label = GROWTH_RUN_PHASE_LABELS[phase as GrowthRunPhase] ?? phase;
  const entry = phaseStatus[phase] as {
    status?: string;
    count?: number;
    structures?: number;
    evidenceCount?: number;
    videoSaved?: number;
    patternsMined?: number;
    candidatesSaved?: number;
    itemCount?: number;
    lowConfidence?: boolean;
    confidence?: number;
  } | undefined;
  if (entry?.status === "running" || !entry?.status) return `${label}…`;
  if (entry.status === "failed") return `${label} failed`;
  if (phase === "deep_discovery" && typeof entry.candidatesSaved === "number") {
    const saved = entry.candidatesSaved as number;
    return `Found ${saved} source candidate${saved === 1 ? "" : "s"}`;
  }
  if (phase === "video_discovery" && typeof entry.videoSaved === "number") {
    const saved = entry.videoSaved;
    return `Saved ${saved} video evidence item${saved === 1 ? "" : "s"}`;
  }
  if (phase === "pattern_mining" && typeof entry.patternsMined === "number") {
    const mined = entry.patternsMined;
    return mined > 0
      ? `Mined ${mined} pattern${mined === 1 ? "" : "s"}`
      : "Pattern mining complete (sparse evidence)";
  }
  if (phase === "trendhop" && typeof entry.itemCount === "number") {
    return `Found ${entry.itemCount} trend hop${entry.itemCount === 1 ? "" : "s"}`;
  }
  if (phase === "autobrief" && entry.status === "succeeded") {
    return "Product brief generated";
  }
  if (phase === "concepts" && typeof entry.count === "number") {
    return `Generated ${entry.count} video concept${entry.count === 1 ? "" : "s"}`;
  }
  if (phase === "videotrend" && typeof entry.structures === "number") {
    const thin =
      entry.lowConfidence === true ||
      (typeof entry.evidenceCount === "number" && entry.evidenceCount < 3);
    const base = `Found ${entry.structures} winning structure${entry.structures === 1 ? "" : "s"}`;
    return thin ? `${base} (thin evidence — add Sources for stronger patterns)` : base;
  }
  if (phase === "videos" && typeof entry.count === "number") {
    return `Rendered ${entry.count} video${entry.count === 1 ? "" : "s"}`;
  }
  return `${label} complete`;
}
