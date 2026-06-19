import Link from "next/link";
import { ArrowRight, Plus, Sparkles, LayoutGrid } from "lucide-react";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { formatRelativeTime } from "@/lib/utils";

export const metadata = { title: "Projects" };

export default async function ProjectsPage() {
  const projects = await loadProjects();
  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Your growth engines"
        description="Each project is a self-contained growth loop. Create one per product or distinct ICP."
        actions={
          <Button asChild>
            <Link href="/projects/new">
              <Plus className="h-4 w-4" /> New project
            </Link>
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={<Sparkles className="h-5 w-5" />}
          title="Build your first growth engine"
          description="Drop your product URL, add a few competitors, and let TrendWatch reverse-engineer your niche."
          action={
            <Button asChild size="lg" variant="glow">
              <Link href="/projects/new">
                Create my first project
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p, i) => (
            <Link
              key={p.id}
              href={`/projects/${p.id}`}
              className="group rounded-xl border border-border bg-card p-5 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 hover:-translate-y-0.5 transition-all duration-300 animate-slide-in"
              style={{ animationDelay: `${i * 60}ms` }}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h3 className="font-semibold tracking-tight truncate">{p.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground truncate">
                    {p.niche || p.product_url || "No niche set yet"}
                  </p>
                </div>
                <Badge variant={p.status === "active" || p.status === "brief_saved" ? "success" : p.status === "brief_failed" ? "destructive" : "secondary"}>{p.status}</Badge>
              </div>

              <div className="mt-5 grid grid-cols-3 gap-3 text-xs">
                <Stat label="TrendWatch" value={p.lastTrendwatch ? formatRelativeTime(p.lastTrendwatch) : "—"} />
                <Stat label="Posts" value={String(p.postCount)} />
                <Stat label="Winners" value={String(p.winnerCount)} />
              </div>

              <div className="mt-4 inline-flex items-center text-xs font-medium text-primary opacity-0 group-hover:opacity-100 transition-opacity">
                Open project <ArrowRight className="ml-1 h-3 w-3" />
              </div>
            </Link>
          ))}

          <Link
            href="/projects/new"
            className="rounded-xl border border-dashed border-border bg-card/40 p-5 flex flex-col items-center justify-center text-center hover:border-primary/40 hover:bg-card transition-all min-h-[180px]"
          >
            <div className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Plus className="h-5 w-5" />
            </div>
            <span className="mt-3 text-sm font-medium">New project</span>
            <span className="mt-1 text-xs text-muted-foreground">Start a new growth loop</span>
          </Link>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div className="mt-0.5 font-semibold text-foreground">{value}</div>
    </div>
  );
}

interface ProjectListItem {
  id: string;
  name: string;
  niche: string | null;
  product_url: string | null;
  status: string;
  lastTrendwatch: string | null;
  postCount: number;
  winnerCount: number;
}

async function loadProjects(): Promise<ProjectListItem[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data: projects } = await supabase
    .from("projects")
    .select("id, name, niche, product_url, status, updated_at")
    .order("updated_at", { ascending: false });

  if (!projects) return [];

  const ids = projects.map((p) => p.id);
  if (ids.length === 0) return projects.map(toItem);

  const [{ data: tw }, { data: posts }, { data: wins }] = await Promise.all([
    supabase
      .from("trendwatch_runs")
      .select("project_id, completed_at, created_at")
      .in("project_id", ids)
      .order("created_at", { ascending: false }),
    supabase.from("generated_posts").select("project_id").in("project_id", ids),
    supabase.from("winners").select("project_id").in("project_id", ids),
  ]);

  const twByProject = new Map<string, string>();
  for (const r of tw ?? []) {
    if (!twByProject.has(r.project_id)) {
      twByProject.set(r.project_id, r.completed_at ?? r.created_at);
    }
  }
  const postCounts = new Map<string, number>();
  for (const p of posts ?? []) postCounts.set(p.project_id, (postCounts.get(p.project_id) ?? 0) + 1);
  const winCounts = new Map<string, number>();
  for (const w of wins ?? []) winCounts.set(w.project_id, (winCounts.get(w.project_id) ?? 0) + 1);

  return projects.map((p) => ({
    ...toItem(p),
    lastTrendwatch: twByProject.get(p.id) ?? null,
    postCount: postCounts.get(p.id) ?? 0,
    winnerCount: winCounts.get(p.id) ?? 0,
  }));
}

function toItem(p: { id: string; name: string; niche: string | null; product_url: string | null; status: string }): ProjectListItem {
  return {
    id: p.id,
    name: p.name,
    niche: p.niche,
    product_url: p.product_url,
    status: p.status,
    lastTrendwatch: null,
    postCount: 0,
    winnerCount: 0,
  };
}
