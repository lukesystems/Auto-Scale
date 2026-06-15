import Link from "next/link";
import { Brain, ExternalLink, Network } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { AddSourceForm } from "./add-source-form";
import { AddCompetitorForm } from "./add-competitor-form";
import { DeleteSourceButton } from "./delete-source-button";

interface PageProps { params: { id: string } }

export const metadata = { title: "Sources" };

export default async function SourcesPage({ params }: PageProps) {
  const [competitors, sources] = await Promise.all([
    loadCompetitors(params.id),
    loadSources(params.id),
  ]);

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Competitors & sources"
        description="Add the URLs, accounts, and posts TrendWatch should learn from. The richer the input, the sharper the analysis."
        actions={
          <Button asChild>
            <Link href={`/projects/${params.id}/trendwatch`}>
              <Brain className="h-4 w-4" /> Run TrendWatch
            </Link>
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[1fr_2fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold tracking-tight">Add a competitor</h3>
            <p className="mt-1 text-xs text-muted-foreground">High-level companies you study.</p>
            <div className="mt-4">
              <AddCompetitorForm projectId={params.id} />
            </div>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h3 className="font-semibold tracking-tight">Add a source post</h3>
            <p className="mt-1 text-xs text-muted-foreground">Specific posts, accounts, or URLs to analyze.</p>
            <div className="mt-4">
              <AddSourceForm projectId={params.id} />
            </div>
          </div>
        </div>

        <div className="space-y-6">
          <section>
            <h3 className="font-semibold tracking-tight">Competitors ({competitors.length})</h3>
            <div className="mt-3 space-y-2">
              {competitors.length === 0 ? (
                <div className="rounded-lg border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground">
                  No competitors yet. Add a few above.
                </div>
              ) : (
                competitors.map((c) => (
                  <div key={c.id} className="rounded-lg border border-border bg-card px-4 py-3 flex items-center gap-3">
                    <div className="inline-flex h-8 w-8 items-center justify-center rounded-full bg-primary/10 text-primary text-xs font-semibold">
                      {c.name.slice(0, 1).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium truncate">{c.name}</div>
                      {c.url && (
                        <a href={c.url} target="_blank" rel="noreferrer" className="text-xs text-muted-foreground hover:text-foreground inline-flex items-center gap-1 truncate">
                          {c.url} <ExternalLink className="h-3 w-3" />
                        </a>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </section>

          <section>
            <h3 className="font-semibold tracking-tight">Source posts ({sources.length})</h3>
            <div className="mt-3 space-y-2">
              {sources.length === 0 ? (
                <EmptyState
                  icon={<Network className="h-5 w-5" />}
                  title="No source posts yet"
                  description="TrendWatch can still run on the niche alone, but signal is much sharper with concrete examples."
                />
              ) : (
                sources.map((s) => (
                  <div key={s.id} className="rounded-lg border border-border bg-card p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Badge variant="outline">{s.platform}</Badge>
                        {s.account_handle && <span className="text-sm font-medium">@{s.account_handle}</span>}
                        {s.account_type && s.account_type !== "unknown" && (
                          <Badge variant="secondary">{s.account_type}</Badge>
                        )}
                      </div>
                      <DeleteSourceButton projectId={params.id} sourceId={s.id} />
                    </div>
                    {s.source_url && (
                      <a href={s.source_url} target="_blank" rel="noreferrer" className="mt-2 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground truncate max-w-full">
                        {s.source_url} <ExternalLink className="h-3 w-3" />
                      </a>
                    )}
                    {s.notes && <p className="mt-2 text-sm text-foreground/80">{s.notes}</p>}
                  </div>
                ))
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}

async function loadCompetitors(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("competitors")
    .select("id, name, url, notes")
    .eq("project_id", projectId)
    .order("created_at", { ascending: true });
  return data ?? [];
}

async function loadSources(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("trendwatch_sources")
    .select("id, platform, account_handle, account_type, source_url, notes")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
