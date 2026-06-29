export type ApprovalPolicy = "auto_approve_all" | "ask_at_critical" | "ask_at_every_stage";

/** Phases where the run may pause for user approval (micro-gates + stage boundaries). */
export type ApprovalGatePhase =
  | "autobrief"
  | "deep_discovery"
  | "video_discovery"
  | "pattern_mining"
  | "trendhop"
  | "videotrend"
  | "concepts"
  | "storyboards"
  | "videos"
  | "approval"
  | "schedule";

const CRITICAL_GATES = new Set<ApprovalGatePhase>(["autobrief", "videos", "schedule"]);

const ALL_GATES = new Set<ApprovalGatePhase>([
  "autobrief",
  "deep_discovery",
  "video_discovery",
  "pattern_mining",
  "trendhop",
  "concepts",
  "videos",
  "schedule",
]);

export function shouldPauseAtPhase(
  policy: ApprovalPolicy,
  phase: ApprovalGatePhase
): boolean {
  if (policy === "auto_approve_all") return false;
  if (policy === "ask_at_every_stage") return ALL_GATES.has(phase);
  return CRITICAL_GATES.has(phase);
}

export const APPROVAL_POLICY_LABELS: Record<ApprovalPolicy, string> = {
  auto_approve_all: "Auto-approve everything",
  ask_at_critical: "Ask me at critical steps (brief, videos, posting)",
  ask_at_every_stage: "Ask me at every stage",
};

export const APPROVAL_POLICY_DESCRIPTIONS: Record<ApprovalPolicy, string> = {
  auto_approve_all:
    "Within-stage micro-gates are skipped, but the four macro stages still pause for your review before strategy, video production, and scheduling.",
  ask_at_critical:
    "Pause after the product brief is ready (before discovery), after videos are rendered, and before posting — plus mandatory pauses at each macro stage.",
  ask_at_every_stage:
    "Pause after brief, discovery, patterns, trend hops, concepts, videos, and before posting — plus mandatory pauses at each macro stage.",
};
