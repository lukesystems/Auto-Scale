"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const TABS = [
  { id: "brief", label: "Brief" },
  { id: "sources", label: "Sources" },
  { id: "videos", label: "Videos" },
  { id: "patterns", label: "Patterns" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function RunEvidenceTabs({
  briefContent,
  sourcesContent,
  videosContent,
  patternsContent,
  defaultTab = "brief",
}: {
  briefContent: React.ReactNode;
  sourcesContent: React.ReactNode;
  videosContent: React.ReactNode;
  patternsContent: React.ReactNode;
  defaultTab?: TabId;
}) {
  const [tab, setTab] = useState<TabId>(defaultTab);

  const content = {
    brief: briefContent,
    sources: sourcesContent,
    videos: videosContent,
    patterns: patternsContent,
  }[tab];

  return (
    <div className="rounded-xl border border-border bg-card">
      <div className="flex border-b border-border overflow-x-auto">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={cn(
              "px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors",
              tab === t.id
                ? "border-primary text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>
      <div className="p-4">{content}</div>
    </div>
  );
}
