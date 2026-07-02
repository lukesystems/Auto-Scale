/**
 * Single source of truth for "what should the founder do next?"
 */

import type { ProjectPipelineStats } from "@/lib/project-pipeline";

export interface NextMoveContext {
  projectId: string;
  activeRunId?: string | null;
  stats: Pick<
    ProjectPipelineStats,
    | "growthRunCompletedCount"
    | "growthVideoReadyCount"
    | "growthScheduledCount"
    | "winnerCount"
  >;
}

export interface NextMove {
  label: string;
  description: string;
  href: string;
  kind: "growth" | "winners" | "noop";
}

export function getNextMove(ctx: NextMoveContext): NextMove {
  const base = `/projects/${ctx.projectId}`;
  const runHref = ctx.activeRunId
    ? `${base}/growth/${ctx.activeRunId}`
    : `${base}/growth`;

  if (ctx.stats.winnerCount > 0) {
    return {
      label: "Compound your winners",
      description: "Turn what brought users into stronger variants for the next batch.",
      href: `${base}/growth/winners`,
      kind: "winners",
    };
  }

  if (
    ctx.stats.growthRunCompletedCount === 0 &&
    ctx.stats.growthVideoReadyCount === 0 &&
    ctx.stats.growthScheduledCount === 0
  ) {
    return {
      label: "Start AutoScale",
      description: "Paste your product URL to run the full loop end to end.",
      href: `${base}/growth`,
      kind: "growth",
    };
  }

  return {
    label: "Open active run",
    description: "Track experiments, approve videos, and schedule posts.",
    href: runHref,
    kind: "growth",
  };
}
