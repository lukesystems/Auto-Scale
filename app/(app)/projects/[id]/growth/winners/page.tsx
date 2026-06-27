import Link from "next/link";
import { Trophy, Rocket } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { NextMoveBanner } from "@/components/app/next-move-banner";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { isBriefComplete } from "@/lib/brief-completeness";
import { getProductBrief, getProjectStats } from "../../queries";
import { getNextMove } from "@/lib/next-move";
import { formatRelativeTime } from "@/lib/utils";
import { formatVideoTypeLabel } from "@/lib/growth-run/video-type-labels";
import { compoundWinnerAction } from "./actions";

interface PageProps {
  params: { id: string };
}

export const metadata = { title: "Winners" };

export default async function GrowthWinnersPage({ params }: PageProps) {
  const [winners, brief, stats] = await Promise.all([
    loadWinners(params.id),
    getProductBrief(params.id),
    getProjectStats(params.id),
  ]);

  const next = getNextMove({
    projectId: params.id,
    briefComplete: isBriefComplete(brief),
    stats,
  });

  return (
    <div className="container space-y-6 py-8">
      <PageHeader
        title="Winners"
        description="Videos classified as winners from growth_experiment_results + latest metrics. Compound each into variants for the next exploitation batch."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link href={`/projects/${params.id}/growth`}>
              <Rocket className="h-4 w-4" /> Growth Run hub
            </Link>
          </Button>
        }
      />

      <NextMoveBanner move={next} />

      <p className="text-sm text-muted-foreground rounded-lg border border-border/60 bg-muted/30 px-4 py-3">
        Save-rate signal (Nadia): 2–3% saves/views often indicates conversion intent on TikTok and
        Instagram — iterate CTA when saves are strong but signups lag.
      </p>

      {winners.length === 0 ? (
        <EmptyState
          icon={<Trophy className="h-5 w-5" />}
          title="No winners yet"
          description="Ship a Growth Run, ingest metrics, then run Compound. Winners appear here with classification and latest snapshot metrics."
          action={
            <Button asChild variant="glow">
              <Link href={`/projects/${params.id}/growth`}>Start a Growth Run</Link>
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3 sm:grid-cols-2">
          {winners.map((w) => (
            <article key={w.id} className="rounded-xl border border-border bg-card p-5 space-y-3">
              <div className="flex items-center justify-between">
                <Badge variant={w.classification === "winner" ? "success" : "secondary"}>
                  <Trophy className="h-3 w-3" /> {w.classification}
                </Badge>
                <span className="text-xs text-muted-foreground">{formatRelativeTime(w.created_at)}</span>
              </div>
              <h3 className="font-semibold tracking-tight line-clamp-2">{w.hook ?? `Video ${w.video_id.slice(0, 8)}…`}</h3>
              {w.diagnosis && <p className="text-sm text-muted-foreground">{w.diagnosis}</p>}
              <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                {w.views != null ? <span>{w.views.toLocaleString()} views</span> : null}
                {w.saveRate != null ? (
                  <span className={w.saveRate >= 0.02 ? "text-amber-600 dark:text-amber-400 font-medium" : ""}>
                    {(w.saveRate * 100).toFixed(1)}% save rate
                    {w.saves != null ? ` (${w.saves} saves)` : ""}
                  </span>
                ) : w.saves != null ? (
                  <span>{w.saves} saves</span>
                ) : null}
                {w.signups != null ? <span>{w.signups} signups</span> : null}
                {w.videoType ? <span>{formatVideoTypeLabel(w.videoType)}</span> : null}
                {w.platform ? <span className="capitalize">{w.platform}</span> : null}
              </div>
              {w.classification === "winner" ? (
                <form action={compoundWinnerAction}>
                  <input type="hidden" name="projectId" value={params.id} />
                  <input type="hidden" name="experimentResultId" value={w.id} />
                  <input type="hidden" name="videoId" value={w.video_id} />
                  <input type="hidden" name="growthRunId" value={w.growth_run_id} />
                  <Button type="submit" size="sm" variant="default">
                    <Rocket className="h-3.5 w-3.5" /> Compound into variants
                  </Button>
                </form>
              ) : (
                <Button asChild size="sm" variant="outline">
                  <Link href={`/projects/${params.id}/growth/${w.growth_run_id}`}>View run</Link>
                </Button>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

type WinnerRow = {
  id: string;
  video_id: string;
  growth_run_id: string;
  classification: string;
  diagnosis: string | null;
  created_at: string;
  hook: string | null;
  platform: string | null;
  videoType: string | null;
  views: number | null;
  saves: number | null;
  saveRate: number | null;
  signups: number | null;
};

async function loadWinners(projectId: string): Promise<WinnerRow[]> {
  if (!isSupabaseConfigured()) return [];
  const supabase = createSupabaseServerClient();

  const { data: results } = await supabase
    .from("growth_experiment_results")
    .select("id, video_id, growth_run_id, classification, diagnosis, metric_summary, created_at, latest_metrics_snapshot_id")
    .eq("project_id", projectId)
    .in("classification", ["winner", "promising"])
    .order("created_at", { ascending: false });

  if (!results?.length) return [];

  const videoIds = results.map((r) => r.video_id);
  const snapshotIds = results
    .map((r) => r.latest_metrics_snapshot_id)
    .filter((id): id is string => Boolean(id));

  const [{ data: videos }, { data: snapshots }] = await Promise.all([
    supabase
      .from("videos")
      .select("id, concept_id")
      .in("id", videoIds),
    snapshotIds.length
      ? supabase.from("metrics_snapshots").select("id, views, saves").in("id", snapshotIds)
      : Promise.resolve({ data: [] as Array<{ id: string; views: number | null; saves: number | null }> }),
  ]);

  const conceptIds = (videos ?? []).map((v) => v.concept_id).filter(Boolean) as string[];
  const { data: concepts } = conceptIds.length
    ? await supabase.from("video_concepts").select("id, hook, platform, video_type").in("id", conceptIds)
    : { data: [] as Array<{ id: string; hook: string; platform: string; video_type: string }> };

  const conceptById = new Map((concepts ?? []).map((c) => [c.id, c]));
  const videoConceptId = new Map((videos ?? []).map((v) => [v.id, v.concept_id]));
  const snapshotViews = new Map((snapshots ?? []).map((s) => [s.id, s.views]));
  const snapshotSaves = new Map((snapshots ?? []).map((s) => [s.id, s.saves]));

  return results.map((r) => {
    const conceptId = videoConceptId.get(r.video_id);
    const concept = conceptId ? conceptById.get(conceptId) : null;
    const summary = (r.metric_summary ?? {}) as Record<string, unknown>;
    const views =
      (r.latest_metrics_snapshot_id ? snapshotViews.get(r.latest_metrics_snapshot_id) : null) ??
      (typeof summary.views === "number" ? summary.views : null);
    const saves =
      (r.latest_metrics_snapshot_id ? snapshotSaves.get(r.latest_metrics_snapshot_id) : null) ??
      (typeof summary.saves === "number" ? summary.saves : null);
    const saveRate =
      typeof summary.save_rate === "number"
        ? summary.save_rate
        : views != null && views > 0 && saves != null
          ? saves / views
          : null;
    return {
      id: r.id,
      video_id: r.video_id,
      growth_run_id: r.growth_run_id,
      classification: r.classification,
      diagnosis: r.diagnosis,
      created_at: r.created_at,
      hook: concept?.hook ?? null,
      platform: concept?.platform ?? null,
      videoType: concept?.video_type ?? null,
      views: views ?? null,
      saves: saves ?? null,
      saveRate,
      signups: typeof summary.signups === "number" ? summary.signups : null,
    };
  });
}
