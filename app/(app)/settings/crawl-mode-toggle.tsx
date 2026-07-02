"use client";

import { useTransition } from "react";
import { updateCrawlModeAction } from "./crawl-mode-actions";

interface CrawlModeToggleProps {
  currentMode: "llm" | "heuristic";
}

export function CrawlModeToggle({ currentMode }: CrawlModeToggleProps) {
  const [pending, startTransition] = useTransition();

  function setMode(mode: "llm" | "heuristic") {
    const fd = new FormData();
    fd.set("crawlMode", mode);
    startTransition(() => updateCrawlModeAction(fd));
  }

  return (
    <div className="flex flex-wrap gap-2">
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("llm")}
        className={`rounded-md border px-3 py-2 text-sm ${currentMode === "llm" ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`}
      >
        LLM crawl (recommended)
      </button>
      <button
        type="button"
        disabled={pending}
        onClick={() => setMode("heuristic")}
        className={`rounded-md border px-3 py-2 text-sm ${currentMode === "heuristic" ? "border-primary bg-primary/10 font-medium" : "hover:bg-muted"}`}
      >
        Fast heuristic
      </button>
    </div>
  );
}
