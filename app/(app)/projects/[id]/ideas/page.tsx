import Link from "next/link";
import { Lightbulb, Sparkles, Layers } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { GenerateIdeasButton } from "./generate-ideas-button";
import { GeneratePostButton } from "./generate-post-button";

interface PageProps { params: { id: string } }
export const metadata = { title: "Ideas" };

export default async function IdeasPage({ params }: PageProps) {
  const [hooks, ideas] = await Promise.all([
    loadHooks(params.id),
    loadIdeas(params.id),
  ]);

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Hooks & content ideas"
        description="Every hook is anchored to a TrendWatch insight. Every idea is a hypothesis with a metric to watch."
        actions={<GenerateIdeasButton projectId={params.id} hasHooks={hooks.length > 0} />}
      />

      {hooks.length === 0 && ideas.length === 0 ? (
        <EmptyState
          icon={<Lightbulb className="h-5 w-5" />}
          title="No hooks or ideas yet"
          description="Run TrendWatch first if you haven't, then generate a batch of hooks and ideas."
          action={<GenerateIdeasButton projectId={params.id} hasHooks={false} />}
        />
      ) : (
        <Tabs defaultValue="ideas">
          <TabsList>
            <TabsTrigger value="ideas">Content ideas ({ideas.length})</TabsTrigger>
            <TabsTrigger value="hooks">Hooks ({hooks.length})</TabsTrigger>
          </TabsList>

          <TabsContent value="ideas">
            {ideas.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground text-center">
                No content ideas yet. Generate a batch.
              </div>
            ) : (
              <div className="grid lg:grid-cols-2 gap-4">
                {ideas.map((i) => (
                  <div key={i.id} className="rounded-xl border border-border bg-card p-5 hover:border-primary/30 transition-colors group">
                    <div className="flex items-start justify-between gap-3">
                      <Badge variant="default">{i.format}</Badge>
                      <Badge variant={i.risk_level === "low" ? "success" : i.risk_level === "high" ? "destructive" : "warning"}>
                        {i.risk_level} risk
                      </Badge>
                    </div>
                    <h4 className="mt-3 font-semibold tracking-tight text-balance">{i.hook}</h4>
                    <p className="mt-1.5 text-xs text-muted-foreground">{i.angle}</p>

                    {i.hypothesis && (
                      <div className="mt-3 text-xs">
                        <span className="text-muted-foreground">Hypothesis: </span>
                        <span className="text-foreground/80">{i.hypothesis}</span>
                      </div>
                    )}

                    <div className="mt-3 flex flex-wrap gap-1">
                      {(Array.isArray(i.platforms) ? (i.platforms as string[]) : []).slice(0, 4).map((p) => (
                        <span key={p} className="rounded-md bg-secondary px-2 py-0.5 text-[10px] font-medium text-secondary-foreground">{p}</span>
                      ))}
                      {i.metric_to_watch && (
                        <span className="rounded-md border border-primary/40 bg-primary/5 text-primary px-2 py-0.5 text-[10px] font-semibold">
                          watch: {i.metric_to_watch}
                        </span>
                      )}
                    </div>

                    <div className="mt-4 flex items-center justify-between gap-2">
                      <span className="text-xs text-muted-foreground truncate">{i.target_audience}</span>
                      <GeneratePostButton projectId={params.id} ideaId={i.id} />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="hooks">
            {hooks.length === 0 ? (
              <div className="rounded-lg border border-dashed border-border bg-card/40 p-6 text-sm text-muted-foreground text-center">
                No hooks yet.
              </div>
            ) : (
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
                {hooks.map((h) => (
                  <div key={h.id} className="rounded-lg border border-border bg-card p-4">
                    <p className="text-sm font-medium leading-snug">{h.hook}</p>
                    {h.angle && <p className="mt-2 text-xs text-muted-foreground">{h.angle}</p>}
                  </div>
                ))}
              </div>
            )}
          </TabsContent>
        </Tabs>
      )}

      {ideas.length > 0 && (
        <div className="rounded-xl border border-primary/30 bg-primary/[0.04] p-5 flex items-center justify-between gap-3 flex-wrap">
          <div>
            <h3 className="font-semibold tracking-tight">Ready to draft full posts?</h3>
            <p className="text-sm text-muted-foreground">Click the wand on any idea to generate a slide-by-slide post.</p>
          </div>
          <Button asChild variant="outline">
            <Link href={`/projects/${params.id}/content`}>
              <Layers className="h-4 w-4" /> View drafted posts
            </Link>
          </Button>
        </div>
      )}
    </div>
  );
}

async function loadHooks(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("hooks")
    .select("id, hook, angle")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
}

async function loadIdeas(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("content_ideas")
    .select("id, format, hook, angle, target_audience, hypothesis, platforms, metric_to_watch, risk_level")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
