import Link from "next/link";
import { FlaskConical, Sparkles, Trophy } from "lucide-react";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeTime } from "@/lib/utils";
import { CompoundButton } from "./compound-button";

interface PageProps { params: { id: string } }
export const metadata = { title: "Winners" };

export default async function WinnersPage({ params }: PageProps) {
  const [winners, winnerCandidates, learnings] = await Promise.all([
    loadWinners(params.id),
    loadWinnerCandidates(params.id),
    loadLearnings(params.id),
  ]);

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        title="Winners & compounding"
        description="Diagnose why a post won, generate 10 variants, build next week's plan, and write learnings to project memory."
      />

      {winnerCandidates.length > 0 && (
        <section>
          <h3 className="font-semibold tracking-tight mb-3">Ready to compound ({winnerCandidates.length})</h3>
          <div className="grid lg:grid-cols-2 gap-4">
            {winnerCandidates.map((w) => (
              <div key={w.id} className="rounded-xl border border-primary/40 bg-primary/[0.04] p-5">
                <div className="flex items-center gap-2">
                  <Badge variant="success"><Trophy className="h-3 w-3" /> winner</Badge>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(w.posted_at)}</span>
                </div>
                <h4 className="mt-3 font-semibold tracking-tight text-balance">{w.hook}</h4>
                <div className="mt-3 grid grid-cols-4 gap-2 text-xs">
                  <Metric label="Views" value={w.views} />
                  <Metric label="Saves" value={w.saves} />
                  <Metric label="Clicks" value={w.clicks} />
                  <Metric label="Signups" value={w.signups} />
                </div>
                <div className="mt-4">
                  <CompoundButton projectId={params.id} experimentId={w.id} />
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {winners.length === 0 && winnerCandidates.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title="No winners yet"
          description="Mark an experiment as 'winner' to unlock compounding. Then come back here for variants and next-week plan."
          action={
            <Button asChild>
              <Link href={`/projects/${params.id}/experiments`}>
                <FlaskConical className="h-4 w-4" /> Go to experiments
              </Link>
            </Button>
          }
        />
      ) : (
        winners.length > 0 && (
          <section>
            <h3 className="font-semibold tracking-tight mb-3">Compounded winners ({winners.length})</h3>
            <div className="space-y-4">
              {winners.map((w) => (
                <div key={w.id} className="rounded-xl border border-border bg-card p-6">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <h4 className="font-semibold tracking-tight">{w.hook}</h4>
                      <p className="text-xs text-muted-foreground">Diagnosed {formatRelativeTime(w.created_at)} · {w.variants.length} variants</p>
                    </div>
                    <Badge variant="success"><Sparkles className="h-3 w-3" /> compounded</Badge>
                  </div>

                  {w.winning_reason && (
                    <p className="mt-3 text-sm text-foreground/80 border-l-2 border-primary/30 pl-4">
                      {w.winning_reason}
                    </p>
                  )}

                  {w.recommended_next_actions.length > 0 && (
                    <div className="mt-4">
                      <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Recommended actions</h5>
                      <ul className="mt-2 space-y-1.5 text-sm">
                        {w.recommended_next_actions.map((a, i) => (
                          <li key={i} className="text-foreground/80">→ {a}</li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {w.variants.length > 0 && (
                    <div className="mt-5">
                      <h5 className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">Variants ({w.variants.length})</h5>
                      <div className="mt-2 grid sm:grid-cols-2 gap-2">
                        {w.variants.map((v) => (
                          <div key={v.id} className="rounded-lg border border-border bg-secondary/30 p-3">
                            <p className="text-sm font-medium leading-snug">{v.hook}</p>
                            {v.angle && <p className="mt-1 text-xs text-muted-foreground">{v.angle}</p>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </section>
        )
      )}

      {learnings.length > 0 && (
        <section>
          <h3 className="font-semibold tracking-tight mb-3">Project memory ({learnings.length})</h3>
          <div className="rounded-xl border border-border bg-card divide-y divide-border">
            {learnings.map((l) => (
              <div key={l.id} className="px-5 py-4">
                <div className="flex items-center gap-2">
                  <Badge variant="outline">{l.category ?? "learning"}</Badge>
                  <span className="text-xs text-muted-foreground">{formatRelativeTime(l.created_at)}</span>
                </div>
                <p className="mt-2 text-sm">{l.learning}</p>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number | null }) {
  return (
    <div>
      <div className="text-muted-foreground text-[10px] uppercase tracking-wider">{label}</div>
      <div className="font-mono text-sm">{value ?? "—"}</div>
    </div>
  );
}

async function loadWinnerCandidates(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("experiments")
    .select(`
      id, posted_at, views, saves, clicks, signups,
      post:generated_posts(hook)
    `)
    .eq("project_id", projectId)
    .eq("status", "winner")
    .order("posted_at", { ascending: false });
  return ((data ?? []) as Array<{
    id: string;
    posted_at: string | null;
    views: number | null;
    saves: number | null;
    clicks: number | null;
    signups: number | null;
    post: { hook?: string | null } | null;
  }>).map((e) => ({
    id: e.id,
    posted_at: e.posted_at,
    views: e.views,
    saves: e.saves,
    clicks: e.clicks,
    signups: e.signups,
    hook: (e.post as { hook?: string | null } | null)?.hook ?? "(no hook)",
  }));
}

async function loadWinners(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data: winners } = await supabase
    .from("winners")
    .select(`
      id, winning_reason, winning_elements, recommended_next_actions, created_at,
      experiment:experiments(post:generated_posts(hook))
    `)
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });

  if (!winners || winners.length === 0) return [];

  const winnerRows = winners as Array<{ id: string }>;
  const ids = winnerRows.map((w) => w.id);
  const { data: variants } = await supabase
    .from("variants")
    .select("id, winner_id, hook, angle")
    .in("winner_id", ids);

  const variantMap = new Map<string, Array<{ id: string; hook: string | null; angle: string | null }>>();
  for (const v of variants ?? []) {
    const arr = variantMap.get(v.winner_id) ?? [];
    arr.push({ id: v.id, hook: v.hook, angle: v.angle });
    variantMap.set(v.winner_id, arr);
  }

  return ((winners ?? []) as Array<{
    id: string;
    winning_reason: string | null;
    recommended_next_actions: unknown;
    created_at: string;
    experiment: { post?: { hook?: string } | null } | null;
  }>).map((w) => ({
    id: w.id,
    hook: ((w.experiment as { post?: { hook?: string } } | null)?.post as { hook?: string } | undefined)?.hook ?? "(no hook)",
    winning_reason: w.winning_reason,
    recommended_next_actions: Array.isArray(w.recommended_next_actions) ? (w.recommended_next_actions as string[]) : [],
    created_at: w.created_at,
    variants: variantMap.get(w.id) ?? [],
  }));
}

async function loadLearnings(projectId: string) {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();
  const { data } = await supabase
    .from("learnings")
    .select("id, category, learning, created_at")
    .eq("project_id", projectId)
    .order("created_at", { ascending: false });
  return data ?? [];
}
