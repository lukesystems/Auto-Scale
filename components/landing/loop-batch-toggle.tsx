"use client";

import { useState } from "react";
import { cn } from "@/lib/utils";

const EXPLORE = {
  title: "Exploration batch",
  subtitle: "Run 1 is designed to fail forward.",
  desc: "Wide hook variety, mixed angles, high learning density. Most videos won't win — that's the point.",
  tags: ["5–10 videos", "varied hooks", "trend-hop angles", "save-rate baseline"],
  tone: "from-sky-500/10 via-transparent to-primary/5",
  badge: "batch 1: explore",
} as const;

const EXPLOIT = {
  title: "Exploitation batch",
  subtitle: "Runs 2+ double down on what worked.",
  desc: "Tight variants on proven formats. Kill flat posts. Compound winners into batches you'd never script by hand.",
  tags: ["hook variants", "winner lineage", "learning memory", "higher hit rate"],
  tone: "from-primary/15 via-emerald-500/5 to-transparent",
  badge: "batch 2+: compound",
} as const;

export function LoopBatchToggle() {
  const [mode, setMode] = useState<"explore" | "exploit">("explore");
  const active = mode === "explore" ? EXPLORE : EXPLOIT;

  return (
    <div className="mt-8 space-y-4">
      <div className="flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={() => setMode("explore")}
          className={cn(
            "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors",
            mode === "explore"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          Exploration
        </button>
        <span className="text-primary text-xs">→</span>
        <button
          type="button"
          onClick={() => setMode("exploit")}
          className={cn(
            "rounded-md border px-3 py-1.5 font-mono text-xs transition-colors",
            mode === "exploit"
              ? "border-primary/40 bg-primary/10 text-primary"
              : "border-border bg-background text-muted-foreground hover:text-foreground"
          )}
        >
          Exploitation
        </button>
      </div>

      <div
        className={cn(
          "rounded-xl border border-primary/20 bg-gradient-to-br p-5 md:flex md:items-center md:justify-between md:gap-6",
          active.tone
        )}
      >
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">{active.title}</p>
          <p className="mt-2 text-sm font-medium text-foreground/90">{active.subtitle}</p>
          <p className="mt-2 text-sm text-muted-foreground">{active.desc}</p>
          <ul className="mt-4 flex flex-wrap gap-2">
            {active.tags.map((tag) => (
              <li
                key={tag}
                className="rounded-md border border-border/70 bg-background/70 px-2 py-1 font-mono text-[10px] text-muted-foreground"
              >
                {tag}
              </li>
            ))}
          </ul>
        </div>
        <div className="mt-4 md:mt-0 shrink-0">
          <span className="inline-flex rounded-md border border-primary/40 bg-primary/10 px-3 py-1.5 font-mono text-xs text-primary">
            {active.badge}
          </span>
        </div>
      </div>
    </div>
  );
}
