import Link from "next/link";
import { AlertTriangle, Brain, CheckCircle2, Lightbulb, TrendingUp } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeTime } from "@/lib/utils";
import { RunTrendWatchButton } from "./run-trendwatch-button";

interface PageProps { params: { id: string } }

export const metadata = { title: "TrendWatch" };

export default async function TrendWatchPage({ params }: PageProps) {
  const [runs, insights] = await Promise.all([
    loadRuns(params.id),
    loadInsights(params.id),
  ]);
  const lastRun = runs[0];

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="TrendWatch"
        description="Reverse-engineer what already works. Run TrendWatch any time you add new sources or shift positioning."
        actions={<RunTrendWatchButton projectId={params.id} />}
      />

      {runs.length === 0 ? (
        <EmptyState
          icon={<Brain className="h-5 w-5" />}
          title="No TrendWatch runs yet"
          description="Add competitors and source posts first, then run TrendWatch. It produces structured insights, hooks, and recommended experiments."
          action={<RunTrendWatchButton projectId={params.id} />}
        />
      ) : (
        <>
          <div className="rounded-xl border border-border bg-card p-6">
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <h3 className="font-semibold tracking-tight">Last run</h3>
                <p className="text-xs text-muted-foreground">{formatRelativeTime(lastRun?.completed_at ?? lastRun?.created_at)}</p>
              </div>
              <Badge variant={lastRun?.status === "success" ? "success" : lastRun?.status === "failed" ? "destructive" : "secondary"}>
                {lastRun?.status}
              </Badge>
            </div>

            {lastRun?.notes && (
              <p className="mt-4 text-sm text-foreground/80 leading-relaxed border-l-2 border-primary/30 pl-4">
                {lastRun.notes}
              </p>
            )}

            <div className="mt-4 grid grid-cols-3 gap-3 text-xs">
              <Stat label="Sources" value={String(lastRun?.source_count ?? 0)} />
              <Stat label="Insights" value={String(lastRun?.insight_count ?? insights.length)} />
              <Stat label="Total runs" value={String(runs.length)} />
            </div>

            <div className="mt-5 flex gap-2 flex-wrap">
              <Button asChild variant="outline" size="sm">
                <Link href={`/projects/${params.id}/ideas`}>
                  <Lightbulb className="h-3.5 w-3.5" /> Generate ideas from insights
                </Link>
              </Button>
            </div>
          </div>

          <section>
            <h3 className="font-semibold tracking-tight mb-4">Insights ({insights.length})</h3>
            {insights.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground text-center">
                No insights yet. Run TrendWatch with sources attached for richer output.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 gap-3">
                {insights.map((i) => (
                  <div key={i.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-center justify-between gap-3">
                      <Badge variant={i.format ? "default" : i.hook_pattern ? "outline" : "secondary"}>
                        {i.format ? <><TrendingUp className="h-3 w-3" /> Format</> : i.hook_pattern ? <><Lightbulb className="h-3 w-3" /> Hook</> : <><CheckCircle2 className="h-3 w-3" /> Experiment</>}
                      </Badge>
                      <span className="text-xs text-muted-foreground">signal {(i.signal_score * 100).toFixed(0)}%</span>
                    </div>
                    <p className="mt-3 text-sm leading-relaxed">{i.insight}</p>
                  </div>
                ))}
              </div>
            )}
          </section>

          {runs.length > 1 && (
            <section>
              <h3 className="font-semibold tracking-tight mb-3">Run history</h3>
              <div className="rounded-lg border border-border bg-card divide-y divide-border">
                {runs.map((r) => (
                  <div key={r.id} className="px-4 py-3 flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      {r.status === "success" ? (
                        <CheckCircle2 className="h-3.5 w-3.5 text-success" />
                      ) : r.status === "failed" ? (
                        <AlertTriangle className="h-3.5 w-3.5 text-destructive" />
                      ) : (
                        <span className="h-3.5 w-3.5 rounded-full bg-muted-foreground/30" />
                      )}
                      <span>{formatRelativeTime(r.completed_at ?? r.created_at)}</span>
                    </div>
                    <span className="text-xs text-muted-foreground">{r.insight_count} insights · {r.source_count} sources</span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 font-semibold">{value}</div>
    </div>
  );
}

async function loadRuns(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("trendwatch_runs")
    .select("id, status, notes, source_count, insight_count, created_at, completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function loadInsights(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("trendwatch_insights")
    .select("id, insight, format, hook_pattern, angle, signal_score")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
