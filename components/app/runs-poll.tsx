"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Loader2 } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface RunRow {
  id: string;
  kind: string;
  status: string;
  started_at: string | null;
  href: string;
}

interface RunsPollProps {
  projectId: string;
}

export function RunsPoll({ projectId }: RunsPollProps) {
  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    async function poll() {
      try {
        const res = await fetch(`/api/projects/${projectId}/runs-status`, { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { runs?: RunRow[] };
        if (!cancelled) setRuns(data.runs ?? []);
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    poll();
    const id = setInterval(poll, 3000);
    return () => {
      cancelled = true;
      clearInterval(id);
    };
  }, [projectId]);

  if (loading && runs.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading runs…
      </div>
    );
  }

  if (runs.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        No active or recent runs. Start a Growth Run or TrendHop scan from the hub.
      </p>
    );
  }

  return (
    <ul className="divide-y rounded-lg border bg-card text-sm">
      {runs.map((run) => (
        <li key={`${run.kind}:${run.id}`} className="flex items-center justify-between gap-3 px-4 py-3">
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-medium capitalize">{run.kind.replace(/_/g, " ")}</span>
              <Badge variant={run.status === "running" || run.status === "pending" ? "default" : "secondary"}>
                {run.status}
              </Badge>
            </div>
            {run.started_at ? (
              <p className="text-xs text-muted-foreground mt-0.5">
                Started {new Date(run.started_at).toLocaleString()}
              </p>
            ) : null}
          </div>
          <Link href={run.href} className="text-xs text-primary hover:underline shrink-0">
            Open
          </Link>
        </li>
      ))}
    </ul>
  );
}
