import { Bug, CheckCircle2, XCircle } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "AI runs" };

export default async function AIDebugPage() {
  const runs = await loadRuns();

  return (
    <div className="container py-10 space-y-6">
      <PageHeader
        title="AI runs"
        description="Every AI call is logged here: provider, model, prompt version, raw output, parsed output, retries, latency, and errors."
      />

      {runs.length === 0 ? (
        <EmptyState
          icon={<Bug className="h-5 w-5" />}
          title="No AI runs yet"
          description="Generate a product brief, run TrendWatch, or draft a post to populate this log."
        />
      ) : (
        <div className="space-y-3">
          {runs.map((r) => (
            <details key={r.id} className="rounded-xl border border-border bg-card overflow-hidden group">
              <summary className="cursor-pointer list-none px-5 py-4 flex items-center justify-between gap-3 hover:bg-secondary/30">
                <div className="flex items-center gap-3 flex-1 min-w-0">
                  {r.status === "success" ? (
                    <CheckCircle2 className="h-4 w-4 text-success shrink-0" />
                  ) : (
                    <XCircle className="h-4 w-4 text-destructive shrink-0" />
                  )}
                  <Badge variant="outline">{r.kind}</Badge>
                  <span className="text-xs font-mono text-muted-foreground">{r.provider}/{r.model}</span>
                  <span className="ml-auto text-xs text-muted-foreground">{formatRelativeTime(r.created_at)} · {r.latency_ms ?? "?"}ms{r.retry_count ? ` · ${r.retry_count} retries` : ""}</span>
                </div>
              </summary>
              <div className="px-5 py-4 border-t border-border bg-secondary/30 space-y-3 text-xs">
                {r.error_message && (
                  <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-destructive">
                    {r.error_message}
                  </div>
                )}
                <details>
                  <summary className="cursor-pointer text-foreground/70 hover:text-foreground font-mono">Input</summary>
                  <pre className="mt-2 rounded-md bg-background border border-border p-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">{safeJSON(r.input)}</pre>
                </details>
                <details>
                  <summary className="cursor-pointer text-foreground/70 hover:text-foreground font-mono">Parsed output</summary>
                  <pre className="mt-2 rounded-md bg-background border border-border p-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px]">{safeJSON(r.parsed_output)}</pre>
                </details>
                {r.raw_output && (
                  <details>
                    <summary className="cursor-pointer text-foreground/70 hover:text-foreground font-mono">Raw output</summary>
                    <pre className="mt-2 rounded-md bg-background border border-border p-3 overflow-x-auto whitespace-pre-wrap font-mono text-[11px] max-h-96">{r.raw_output}</pre>
                  </details>
                )}
              </div>
            </details>
          ))}
        </div>
      )}
    </div>
  );
}

function safeJSON(v: unknown): string {
  try {
    return JSON.stringify(v, null, 2);
  } catch {
    return String(v);
  }
}

import type { Database } from "@/lib/supabase/types";

type AIRunListItem = Pick<
  Database["public"]["Tables"]["ai_runs"]["Row"],
  "id" | "kind" | "provider" | "model" | "status" | "latency_ms" | "retry_count" | "input" | "parsed_output" | "raw_output" | "error_message" | "created_at"
>;

async function loadRuns(): Promise<AIRunListItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("ai_runs")
    .select("id, kind, provider, model, status, latency_ms, retry_count, input, parsed_output, raw_output, error_message, created_at")
    .order("created_at", { ascending: false })
    .limit(100);
  return (data ?? []) as AIRunListItem[];
}
