"use client";

import { useState } from "react";
import { Download, FileJson, FileText, Loader2, Package } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export function ExportControls({ projectId, approvedCount, totalCount }: { projectId: string; approvedCount: number; totalCount: number }) {
  const [pending, setPending] = useState<string | null>(null);
  const [onlyApproved, setOnlyApproved] = useState(true);

  async function download(kind: "zip" | "csv" | "json") {
    setPending(kind);
    try {
      const params = new URLSearchParams({ kind, scope: onlyApproved ? "approved" : "all" });
      const response = await fetch(`/api/projects/${projectId}/export?${params}`);
      if (!response.ok) {
        const error = await response.text().catch(() => "Export failed");
        throw new Error(error);
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      const ext = kind === "zip" ? "zip" : kind === "csv" ? "csv" : "json";
      a.href = url;
      a.download = `autoscale-export-${Date.now()}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success(`Downloaded ${kind.toUpperCase()} export.`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Export failed.");
    } finally {
      setPending(null);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm">
        <label className="inline-flex items-center gap-2 cursor-pointer">
          <input
            type="checkbox"
            checked={onlyApproved}
            onChange={(e) => setOnlyApproved(e.target.checked)}
            className="h-4 w-4 rounded border-border accent-primary"
          />
          <span>Only approved posts ({approvedCount} of {totalCount})</span>
        </label>
      </div>

      <div className="grid sm:grid-cols-3 gap-3">
        <Button onClick={() => download("zip")} disabled={pending !== null} size="lg" variant="glow" className="w-full">
          {pending === "zip" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Package className="h-4 w-4" />}
          Full ZIP pack
        </Button>
        <Button onClick={() => download("csv")} disabled={pending !== null} size="lg" variant="outline" className="w-full">
          {pending === "csv" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
          CSV only
        </Button>
        <Button onClick={() => download("json")} disabled={pending !== null} size="lg" variant="outline" className="w-full">
          {pending === "json" ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileJson className="h-4 w-4" />}
          JSON only
        </Button>
      </div>
    </div>
  );
}
