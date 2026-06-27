"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ChevronRight, Loader2 } from "lucide-react";

interface RunRow {
  id: string;
  kind: string;
  status: string;
}

interface ProjectRunStatusPillProps {
  projectId: string;
}

export function ProjectRunStatusPill({ projectId }: ProjectRunStatusPillProps) {
  const [running, setRunning] = useState(0);
  const [open, setOpen] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function poll() {
      try {
        const res = await fetch(`/api/projects/${projectId}/runs-status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { runs?: RunRow[] };
        const active = (data.runs ?? []).filter((r) =>
          ["running", "pending", "awaiting_approval", "live"].includes(r.status)
        ).length;
        if (!cancelled) setRunning(active);
      } catch {
        // ignore
      }
    }
    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [projectId]);

  if (running === 0) return null;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-1 text-xs font-medium text-primary"
      >
        <Loader2 className="h-3 w-3 animate-spin" />
        {running} running
      </button>
      {open && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full z-50 mt-2 w-56 rounded-lg border bg-popover p-3 shadow-lg text-sm">
            <p className="text-xs text-muted-foreground mb-2">{running} job(s) in progress</p>
            <Link
              href={`/projects/${projectId}/runs`}
              className="inline-flex items-center gap-1 text-primary hover:underline"
              onClick={() => setOpen(false)}
            >
              Open Run Center <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </>
      )}
    </div>
  );
}
