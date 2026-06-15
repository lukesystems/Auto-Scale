import Link from "next/link";
import { Layers, Lightbulb, Shield } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { PostCard } from "./post-card";

interface PageProps { params: { id: string } }
export const metadata = { title: "Content drafts" };

export default async function ContentPage({ params }: PageProps) {
  const posts = await loadPosts(params.id);

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Generated posts"
        description="Slide-by-slide drafts linked to TrendWatch insights. Send the strong ones to approval."
        actions={
          <Button asChild variant="outline">
            <Link href={`/projects/${params.id}/ideas`}>
              <Lightbulb className="h-4 w-4" /> Draft more from ideas
            </Link>
          </Button>
        }
      />

      {posts.length === 0 ? (
        <EmptyState
          icon={<Layers className="h-5 w-5" />}
          title="No drafts yet"
          description="Head to Ideas and click 'Draft post' on any idea to generate a full carousel or script."
          action={
            <Button asChild>
              <Link href={`/projects/${params.id}/ideas`}>
                <Lightbulb className="h-4 w-4" /> Go to ideas
              </Link>
            </Button>
          }
        />
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap text-xs">
            <FilterChip label="Total" value={posts.length} />
            <FilterChip label="In review" value={posts.filter((p) => p.status === "in_review").length} />
            <FilterChip label="Approved" value={posts.filter((p) => p.status === "approved").length} variant="success" />
            <FilterChip label="Rejected" value={posts.filter((p) => p.status === "rejected").length} variant="destructive" />
            <FilterChip label="Draft" value={posts.filter((p) => p.status === "draft").length} />
          </div>

          <div className="grid lg:grid-cols-2 gap-4">
            {posts.map((p) => (
              <PostCard key={p.id} projectId={params.id} post={p} />
            ))}
          </div>

          <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-5 flex items-center justify-between gap-3 flex-wrap">
            <div>
              <h3 className="font-semibold tracking-tight">Approve before scheduling</h3>
              <p className="text-sm text-muted-foreground">Quality Gate scored each draft. Approve the wins, kill the rest.</p>
            </div>
            <Button asChild>
              <Link href={`/projects/${params.id}/approval`}>
                <Shield className="h-4 w-4" /> Go to approval queue
              </Link>
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

function FilterChip({ label, value, variant }: { label: string; value: number; variant?: "success" | "destructive" }) {
  return (
    <Badge variant={variant ?? "outline"}>
      <span className="text-muted-foreground">{label}:</span>
      <span className="ml-1 font-semibold text-foreground">{value}</span>
    </Badge>
  );
}

async function loadPosts(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data: posts } = await supabase
    .from("generated_posts")
    .select("id, format, platform, hook, caption, cta, target_audience, status, quality_score, quality_status, hypothesis, metric_to_watch, quality_reasons, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (!posts || posts.length === 0) return [];

  const ids = posts.map((p) => p.id);
  const { data: slides } = await supabase
    .from("post_slides")
    .select("post_id, slide_number, headline, body")
    .in("post_id", ids)
    .order("slide_number", { ascending: true });

  const slidesByPost = new Map<string, typeof slides>();
  for (const s of slides ?? []) {
    const arr = slidesByPost.get(s.post_id) ?? [];
    arr.push(s);
    slidesByPost.set(s.post_id, arr);
  }

  return posts.map((p) => ({ ...p, slides: slidesByPost.get(p.id) ?? [] }));
}
