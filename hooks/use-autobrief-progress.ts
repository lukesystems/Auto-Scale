"use client";

import { useEffect, useState } from "react";
import type { AutoBriefProgressState } from "@/lib/autobrief/progress-types";

export function useAutobriefProgress(
  projectId: string | null,
  crawlId: string | null,
  enabled: boolean
): AutoBriefProgressState | null {
  const [progress, setProgress] = useState<AutoBriefProgressState | null>(null);

  useEffect(() => {
    if (!enabled || !projectId || !crawlId) {
      setProgress(null);
      return;
    }

    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(
          `/api/projects/${projectId}/autobrief-progress?crawlId=${encodeURIComponent(crawlId!)}`,
          { cache: "no-store" }
        );
        if (!res.ok) return;
        const data = (await res.json()) as { progress?: AutoBriefProgressState };
        if (!cancelled && data.progress) setProgress(data.progress);
      } catch {
        // ignore transient poll errors
      }
    }

    poll();
    const id = setInterval(poll, 1500);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [projectId, crawlId, enabled]);

  return progress;
}
