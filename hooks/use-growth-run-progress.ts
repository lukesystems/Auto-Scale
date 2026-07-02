"use client";

import { useEffect, useState } from "react";
import type { GrowthRunPhase } from "@/lib/growth-run/phase-labels";

export interface GrowthRunProgressState {
  growthRunId: string;
  status: string;
  phase: GrowthRunPhase | string;
  phaseStatus: Record<string, unknown>;
  currentMessage: string;
  error: string | null;
}

export function useGrowthRunProgress(
  projectId: string | null,
  growthRunId: string | null,
  enabled: boolean
): GrowthRunProgressState | null {
  const [progress, setProgress] = useState<GrowthRunProgressState | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || !growthRunId) {
      setProgress(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/growth-runs/${growthRunId}/progress`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as GrowthRunProgressState;
        if (!cancelled) setProgress(data);
      } catch {
        // ignore transient poll errors
      }
    }

    poll();
    const id = setInterval(poll, 2000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [projectId, growthRunId, enabled]);

  return progress;
}
