import Link from "next/link";
import { Package, Send, Shield } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PostCard } from "../content/post-card";

interface PageProps { params: { id: string } }
export const metadata = { title: "Approval queue" };

export default async function ApprovalPage({ params }: PageProps) {
  const queue = await loadQueue(params.id);
  const approved = queue.filter((p) => p.status === "approved");
  const review = queue.filter((p) => p.status === "in_review" || p.status === "draft");
  const rejected = queue.filter((p) => p.status === "rejected");

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Approval queue"
        description="Quality Gate already scored each draft. Approve the wins, kill the rest, schedule the approved."
        actions={
          <div className="flex gap-2">
            <Button asChild variant="outline">
              <Link href={`/projects/${params.id}/exports`}>
                <Package className="h-4 w-4" /> Export
              </Link>
            </Button>
            <Button asChild disabled={approved.length === 0}>
              <Link href={`/projects/${params.id}/schedule`}>
                <Send className="h-4 w-4" /> Schedule approved
              </Link>
            </Button>
          </div>
        }
      />

      {queue.length === 0 ? (
        <EmptyState
          icon={<Shield className="h-5 w-5" />}
          title="Nothing to approve yet"
          description="Generate post drafts first. Quality Gate will score each before they show up here."
        />
      ) : (
        <>
          <Section title="In review" badge={<Badge variant="warning">{review.length}</Badge>}>
            {review.length === 0 ? <Empty>No drafts waiting on you.</Empty> : (
              <div className="grid lg:grid-cols-2 gap-4">
                {review.map((p) => <PostCard key={p.id} projectId={params.id} post={p} approvalMode />)}
              </div>
            )}
          </Section>

          <Section title="Approved" badge={<Badge variant="success">{approved.length}</Badge>}>
            {approved.length === 0 ? <Empty>No approved posts yet.</Empty> : (
              <div className="grid lg:grid-cols-2 gap-4">
                {approved.map((p) => <PostCard key={p.id} projectId={params.id} post={p} />)}
              </div>
            )}
          </Section>

          {rejected.length > 0 && (
            <Section title="Rejected" badge={<Badge variant="destructive">{rejected.length}</Badge>}>
              <div className="grid lg:grid-cols-2 gap-4 opacity-60">
                {rejected.map((p) => <PostCard key={p.id} projectId={params.id} post={p} />)}
              </div>
            </Section>
          )}
        </>
      )}
    </div>
  );
}

function Section({ title, badge, children }: { title: string; badge: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="font-semibold tracking-tight">{title}</h3>
        {badge}
      </div>
      {children}
    </section>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-lg border border-dashed border-border bg-card/40 p-5 text-sm text-muted-foreground text-center">
      {children}
    </div>
  );
}

async function loadQueue(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data: posts } = await supabase
    .from("generated_posts")
    .select("id, format, platform, hook, caption, cta, target_audience, status, quality_score, quality_status, hypothesis, metric_to_watch, quality_reasons, created_at")
    .eq("project_id", projectId)
    .neq("status", "archived")
    .order("created_at", { ascending: false });

  if (!posts || posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const { data: slides } = await supabase
    .from("post_slides")
    .select("post_id, slide_number, headline, body")
    .in("post_id", ids)
    .order("slide_number", { ascending: true });

  const map = new Map<string, typeof slides>();
  for (const s of slides ?? []) {
    const arr = map.get(s.post_id) ?? [];
    arr.push(s);
    map.set(s.post_id, arr);
  }
  return posts.map((p) => ({ ...p, slides: map.get(p.id) ?? [] }));
}
