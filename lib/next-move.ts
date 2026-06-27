/**
 * Single source of truth for "what should the founder do next?" Used on the
 * overview page and individual surfaces (Brief, Sources, Video Intelligence,
 * Growth Hub, Winners) so the recommended action is consistent and the
 * Tier-6 "single emerald CTA per page" rule has a clean foundation.
 */

import type { ProjectPipelineStats } from "@/lib/project-pipeline";

export interface NextMoveContext {
  projectId: string;
  briefComplete: boolean;
  stats: Pick<
    ProjectPipelineStats,
    | "sourceCount"
    | "videoEvidenceCount"
    | "growthRunCompletedCount"
    | "growthVideoReadyCount"
    | "growthScheduledCount"
    | "winnerCount"
  >;
  trendhopFreshCount?: number;
}

export interface NextMove {
  label: string;
  description: string;
  href: string;
  kind:
    | "brief"
    | "sources"
    | "video-intelligence"
    | "growth"
    | "winners"
    | "trendwatch"
    | "noop";
}

export function getNextMove(ctx: NextMoveContext): NextMove {
  const base = `/projects/${ctx.projectId}`;

  if (!ctx.briefComplete) {
    return {
      label: "Complete the product brief",
      description:
        "Define the ICP, pain, offer, and CTA so Growth Run and TrendWatch stay on-target.",
      href: `${base}/brief`,
      kind: "brief",
    };
  }

  if (ctx.stats.sourceCount === 0) {
    return {
      label: "Add or discover sources",
      description: "Growth Run needs public evidence to reason about formats that work.",
      href: `${base}/sources`,
      kind: "sources",
    };
  }

  if (ctx.stats.videoEvidenceCount < 3) {
    return {
      label: "Import 3 reference videos",
      description: "Video Intelligence needs ≥3 short-form references before the loop.",
      href: `${base}/video-intelligence`,
      kind: "video-intelligence",
    };
  }

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
      label: "Start your first Growth Run",
      description: "Exploration batch: AutoScale will ship video experiments and track outcomes.",
      href: `${base}/growth`,
      kind: "growth",
    };
  }

  if ((ctx.trendhopFreshCount ?? 0) > 0) {
    return {
      label: "Review fresh trend hops",
      description: "TrendWatch found new viral patterns this product can credibly join.",
      href: `${base}/trendwatch`,
      kind: "trendwatch",
    };
  }

  return {
    label: "Open Growth Run",
    description: "Track active experiments, mark winners, and queue variants.",
    href: `${base}/growth`,
    kind: "growth",
  };
}
