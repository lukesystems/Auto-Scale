import { GROWTH_RUN_PHASES } from "./phase-labels";

export function getNextGrowthRunPhase(phase: string): string | null {
  const idx = GROWTH_RUN_PHASES.indexOf(phase as (typeof GROWTH_RUN_PHASES)[number]);
  if (idx === -1) return null;
  return GROWTH_RUN_PHASES[idx + 1] ?? null;
}
