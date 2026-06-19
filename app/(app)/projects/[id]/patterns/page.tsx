import Link from "next/link";
import { ExternalLink, Sparkles } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeTime } from "@/lib/utils";
import { RunPatternMiningButton } from "./run-pattern-mining-button";

interface PageProps {
  params: { id: string };
}

export const metadata = { title: "Market Patterns" };

const PATTERN_TYPE_LABELS: Record<string, string> = {
  hook: "Hook",
  pain: "Pain",
  angle: "Angle",
  format: "Format",
  cta: "CTA",
  visual: "Visual",
  offer: "Offer",
  positioning: "Positioning",
};

export default async function PatternsPage({ params }: PageProps) {
  const [runs, patterns, evidence, sourceCount] = await Promise.all([
    loadRuns(params.id),
    loadPatterns(params.id),
    loadEvidence(params.id),
    loadSourceCount(params.id),
  ]);

  const evidenceByPattern = new Map<string, typeof evidence>();
  for (const row of evidence) {
    const list = evidenceByPattern.get(row.pattern_id) ?? [];
    list.push(row);
    evidenceByPattern.set(row.pattern_id, list);
  }

  const grouped = groupPatternsByType(patterns);
  const lastRun = runs[0];

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Market Patterns"
        description="Repeated hooks, pains, angles, formats, and CTAs mined from your accepted TrendWatch sources — with evidence."
        actions={<RunPatternMiningButton projectId={params.id} disabled={sourceCount === 0} />}
      />

      {sourceCount === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Accept sources first"
          description="Pattern mining reads accepted TrendWatch sources. Add sources on the Sources page, accept discovery candidates, then mine patterns here."
          action={
            <Link href={`/projects/${params.id}/sources`} className="text-sm text-primary hover:underline">
              Go to Sources
            </Link>
          }
        />
      ) : patterns.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="No market patterns yet"
          description="Run Pattern Mining to cluster repeated signals across your accepted sources."
          action={<RunPatternMiningButton projectId={params.id} />}
        />
      ) : (
        <>
          {lastRun && (
            <div className="rounded-xl border border-border bg-card p-6">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <h3 className="font-semibold tracking-tight">Last mining run</h3>
                  <p className="text-xs text-muted-foreground">
                    {formatRelativeTime(lastRun.completed_at ?? lastRun.created_at)}
                  </p>
                </div>
                <Badge variant={lastRun.status === "success" ? "success" : lastRun.status === "failed" ? "destructive" : "secondary"}>
                  {lastRun.status}
                </Badge>
              </div>
              <div className="mt-4 grid grid-cols-2 gap-3 text-xs sm:grid-cols-3">
                <Stat label="Sources analyzed" value={String(lastRun.source_count)} />
                <Stat label="Patterns found" value={String(lastRun.pattern_count)} />
                <Stat label="Total runs" value={String(runs.length)} />
              </div>
            </div>
          )}

          {Object.entries(grouped).map(([type, items]) => (
            <section key={type} className="space-y-3">
              <h3 className="font-semibold tracking-tight">
                {PATTERN_TYPE_LABELS[type] ?? type} patterns ({items.length})
              </h3>
              <div className="grid gap-4 lg:grid-cols-2">
                {items.map((pattern) => {
                  const rows = evidenceByPattern.get(pattern.id) ?? [];
                  return (
                    <article key={pattern.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge variant="outline">{PATTERN_TYPE_LABELS[pattern.pattern_type] ?? pattern.pattern_type}</Badge>
                            <Badge variant="secondary">{pattern.support_count} sources</Badge>
                            <Badge
                              variant={
                                pattern.confidence === "high"
                                  ? "success"
                                  : pattern.confidence === "low"
                                    ? "secondary"
                                    : "outline"
                              }
                            >
                              {pattern.confidence}
                            </Badge>
                          </div>
                          <h4 className="mt-2 text-base font-semibold leading-snug">{pattern.label}</h4>
                        </div>
                      </div>

                      <p className="text-sm text-foreground/85">{pattern.summary}</p>

                      {pattern.why_it_matters && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Why it matters</p>
                          <p className="mt-1 text-sm">{pattern.why_it_matters}</p>
                        </div>
                      )}

                      {pattern.how_to_use && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">How to use it</p>
                          <p className="mt-1 text-sm">{pattern.how_to_use}</p>
                        </div>
                      )}

                      {Array.isArray(pattern.examples) && pattern.examples.length > 0 && (
                        <div>
                          <p className="text-xs font-medium text-muted-foreground">Examples</p>
                          <ul className="mt-1 space-y-1 text-sm">
                            {(pattern.examples as string[]).slice(0, 3).map((example) => (
                              <li key={example} className="text-foreground/80">
                                “{example}”
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}

                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Evidence ({rows.length})</p>
                        <ul className="mt-2 space-y-2">
                          {rows.slice(0, 4).map((row) => (
                            <li key={row.id} className="rounded-lg border border-border/70 bg-background/50 p-3 text-sm">
                              <div className="text-xs text-muted-foreground">{row.evidence_field}</div>
                              <p className="mt-1 text-foreground/85">{row.evidence_text}</p>
                              {row.source_url && (
                                <a
                                  href={row.source_url}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="mt-2 inline-flex items-center gap-1 text-xs text-primary hover:underline"
                                >
                                  View source <ExternalLink className="h-3 w-3" />
                                </a>
                              )}
                            </li>
                          ))}
                        </ul>
                      </div>
                    </article>
                  );
                })}
              </div>
            </section>
          ))}
        </>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-border/70 bg-background/40 px-3 py-2">
      <div className="text-muted-foreground">{label}</div>
      <div className="mt-1 text-sm font-semibold">{value}</div>
    </div>
  );
}

function groupPatternsByType<T extends { pattern_type: string }>(patterns: T[]) {
  return patterns.reduce<Record<string, T[]>>((acc, pattern) => {
    const key = pattern.pattern_type;
    acc[key] = acc[key] ?? [];
    acc[key].push(pattern);
    return acc;
  }, {});
}

async function loadRuns(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("market_pattern_runs")
    .select("id, status, source_count, pattern_count, created_at, completed_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false })
    .limit(5);
  return data ?? [];
}

async function loadPatterns(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("market_patterns")
    .select("*")
    .eq("project_id", projectId)
    .order("support_count", { ascending: false });
  return data ?? [];
}

async function loadEvidence(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("market_pattern_evidence")
    .select("id, pattern_id, source_id, source_url, evidence_field, evidence_text")
    .eq("project_id", projectId);
  return data ?? [];
}

async function loadSourceCount(projectId: string) {
  if (!isSupabaseConfigured()) return 0;
  const supabase = createSupabaseServerClient();
  const { count } = await supabase
    .from("trendwatch_sources")
    .select("id", { count: "exact", head: true })
    .eq("project_id", projectId);
  return count ?? 0;
}
