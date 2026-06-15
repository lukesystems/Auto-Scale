import Link from "next/link";
import { FlaskConical, Trophy } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ExperimentRow } from "./experiment-row";

interface PageProps { params: { id: string } }
export const metadata = { title: "Experiments" };

export default async function ExperimentsPage({ params }: PageProps) {
  const experiments = await loadExperiments(params.id);

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Experiment tracker"
        description="Every post is an experiment. Enter metrics, mark winners, kill the losers, and write founder notes."
        actions={
          experiments.some((e) => e.status === "winner") ? (
            <Button asChild>
              <Link href={`/projects/${params.id}/winners`}>
                <Trophy className="h-4 w-4" /> Compound winners
              </Link>
            </Button>
          ) : null
        }
      />

      {experiments.length === 0 ? (
        <EmptyState
          icon={<FlaskConical className="h-5 w-5" />}
          title="No experiments yet"
          description="Schedule a post — it auto-creates an experiment. Or post manually and add a row here."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card divide-y divide-border">
          {experiments.map((e) => (
            <ExperimentRow key={e.id} projectId={params.id} experiment={e} />
          ))}
        </div>
      )}
    </div>
  );
}

async function loadExperiments(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("experiments")
    .select(`
      id, status, posted_at, views, saves, shares, comments, clicks, signups, purchases, revenue, notes,
      post:generated_posts(id, hook, format, platform, metric_to_watch)
    `)
    .eq("project_id", projectId)
    .order("posted_at", { ascending: false, nullsFirst: false });

  return ((data ?? []) as Array<{
    id: string;
    status: string;
    posted_at: string | null;
    views: number | null;
    saves: number | null;
    shares: number | null;
    comments: number | null;
    clicks: number | null;
    signups: number | null;
    purchases: number | null;
    revenue: number | null;
    notes: string | null;
    post: { hook?: string | null; format?: string | null; platform?: string | null; metric_to_watch?: string | null } | null;
  }>).map((row) => ({
    id: row.id,
    status: row.status,
    posted_at: row.posted_at,
    views: row.views,
    saves: row.saves,
    shares: row.shares,
    comments: row.comments,
    clicks: row.clicks,
    signups: row.signups,
    purchases: row.purchases,
    revenue: row.revenue,
    notes: row.notes,
    hook: (row.post as { hook?: string | null } | null)?.hook ?? "(no hook)",
    format: (row.post as { format?: string | null } | null)?.format ?? null,
    platform: (row.post as { platform?: string | null } | null)?.platform ?? null,
    metric_to_watch: (row.post as { metric_to_watch?: string | null } | null)?.metric_to_watch ?? null,
  }));
}
