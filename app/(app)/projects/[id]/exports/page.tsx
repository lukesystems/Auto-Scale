import { Package } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { ExportControls } from "./export-controls";

interface PageProps { params: { id: string } }
export const metadata = { title: "Exports" };

export default async function ExportsPage({ params }: PageProps) {
  const { approvedCount, totalCount } = await loadStats(params.id);

  return (
    <div className="container py-10 space-y-8 max-w-4xl">
      <PageHeader
        title="Export pack"
        description="Manual distribution fallback. Bundles posts, captions, slides, Postiz-ready payloads, and an empty experiment tracker."
      />

      {totalCount === 0 ? (
        <EmptyState
          icon={<Package className="h-5 w-5" />}
          title="Nothing to export yet"
          description="Approve some posts first. Or export all drafts if you want raw output."
        />
      ) : (
        <div className="rounded-xl border border-border bg-card p-6 space-y-5">
          <div className="grid grid-cols-3 gap-3 text-sm">
            <Stat label="Approved" value={approvedCount} />
            <Stat label="Total drafts" value={totalCount} />
            <Stat label="ZIP contents" value="6 files" />
          </div>

          <ExportControls projectId={params.id} approvedCount={approvedCount} totalCount={totalCount} />

          <div className="rounded-lg bg-secondary/50 border border-border p-4">
            <h4 className="text-sm font-semibold tracking-tight">What&apos;s inside the ZIP</h4>
            <ul className="mt-3 grid grid-cols-2 gap-2 text-xs text-muted-foreground">
              <li>posts.csv — flat metadata</li>
              <li>posts.json — full payload</li>
              <li>captions.txt — copy-paste ready</li>
              <li>schedule.csv — schedule template</li>
              <li>postiz-payloads.json — preview</li>
              <li>experiment-tracker.csv — metrics template</li>
            </ul>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-lg border border-border bg-background p-3">
      <div className="text-xs text-muted-foreground">{label}</div>
      <div className="mt-1 text-xl font-semibold tracking-tight">{value}</div>
    </div>
  );
}

async function loadStats(projectId: string) {
  if (!isSupabaseConfigured()) return { approvedCount: 0, totalCount: 0 };
  const supabase = createSupabaseServerClient();
  const [{ count: approved }, { count: total }] = await Promise.all([
    supabase.from("generated_posts").select("id", { count: "exact", head: true }).eq("project_id", projectId).eq("status", "approved"),
    supabase.from("generated_posts").select("id", { count: "exact", head: true }).eq("project_id", projectId),
  ]);
  return { approvedCount: approved ?? 0, totalCount: total ?? 0 };
}
