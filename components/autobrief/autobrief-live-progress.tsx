"use client";

import { useAutobriefProgress } from "@/hooks/use-autobrief-progress";
import { AutoBriefProgressPanel } from "./autobrief-progress-panel";

interface AutobriefLiveProgressProps {
  projectId: string;
  crawlId: string;
  title?: string;
  subtitle?: string;
  showSlowHint?: boolean;
}

export function AutobriefLiveProgress({
  projectId,
  crawlId,
  title,
  subtitle,
  showSlowHint,
}: AutobriefLiveProgressProps) {
  const progress = useAutobriefProgress(projectId, crawlId, true);

  return (
    <AutoBriefProgressPanel
      progress={progress}
      title={title}
      subtitle={subtitle}
      showSlowHint={showSlowHint}
    />
  );
}
