import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  FileText,
  Rocket,
  Sparkles,
  Trophy,
  Video,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { isBriefComplete } from "@/lib/brief-completeness";
import { getNextMove } from "@/lib/next-move";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getProductBrief, getProjectOr404, getProjectStats } from "./queries";

interface PageProps {
  params: { id: string };
}

export async function generateMetadata({ params }: PageProps) {
  const project = await getProjectOr404(params.id);
  return { title: project.name };
}

export default async function ProjectOverviewPage({ params }: PageProps) {
  const [project, brief, stats, growthHealth, trendhopSummary] = await Promise.all([
    getProjectOr404(params.id),
    getProductBrief(params.id),
    getProjectStats(params.id),
    loadGrowthHealth(params.id),
    loadTrendHopSummary(params.id),
  ]);

  const briefOk = isBriefComplete(brief ?? null);
  const next = getNextMove({
    projectId: params.id,
    briefComplete: briefOk,
    stats,
    trendhopFreshCount: trendhopSummary.freshCount,
  });
  const statusIsHealthy = project.status === "brief_saved" || project.status === "active";

  return (
    <div className="bg-[linear-gradient(180deg,hsl(var(--secondary)/0.7)_0%,hsl(var(--background))_280px)]">
      <div className="container space-y-7 py-8">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_22px_70px_-48px_rgba(15,23,42,0.55)] sm:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_70%_35%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,transparent,hsl(var(--secondary)/0.82))] lg:block" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge
                variant={
                  statusIsHealthy
                    ? "success"
                    : project.status === "brief_failed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {project.status}
              </Badge>
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                {project.name}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                {project.niche ||
                  project.description ||
                  "Set your niche in the project brief to sharpen Growth Run."}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <SignalPill label="Brief" done={briefOk} />
                <SignalPill label="Sources" done={stats.sourceCount > 0} />
                <SignalPill label="Video Intelligence" done={stats.videoEvidenceCount > 0} />
                <SignalPill
                  label="Growth Run"
                  done={
                    stats.growthRunCompletedCount > 0 ||
                    stats.growthVideoReadyCount > 0 ||
                    stats.growthScheduledCount > 0
                  }
                />
                <SignalPill label="Winners" done={stats.winnerCount > 0} />
              </div>
            </div>

            <div className="flex shrink-0 flex-col gap-3 rounded-xl border border-primary/15 bg-primary/[0.04] p-4 shadow-inner shadow-primary/5 sm:min-w-72">
              <div className="flex items-center gap-2 text-sm font-semibold text-primary">
                <Sparkles className="h-4 w-4" />
                Recommended next move
              </div>
              <div>
                <h2 className="text-xl font-semibold tracking-tight">{next.label}</h2>
                <p className="mt-1 text-sm leading-6 text-muted-foreground">{next.description}</p>
              </div>
              <Button asChild variant="glow" size="lg" className="mt-1 w-full justify-between">
                <Link href={next.href}>
                  {next.label}
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
            </div>
          </div>
        </section>

        <div className="grid gap-6 xl:grid-cols-[1.06fr_0.94fr]">
          <div className="space-y-5">
            <GrowthHealthPanel projectId={params.id} health={growthHealth} stats={stats} />

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Pipeline</h2>
                  <p className="mt-1 text-sm text-muted-foreground">
                    Brief → Sources → Video Intelligence → Growth Run → Winners → Compounding variants.
                  </p>
                </div>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <PipelineRow done={briefOk} label="Product Brief complete" href={`/projects/${params.id}/brief`} />
                <PipelineRow done={stats.sourceCount > 0} label="Sources gathered" href={`/projects/${params.id}/sources`} />
                <PipelineRow done={stats.videoEvidenceCount > 0} label="Video Intelligence references" href={`/projects/${params.id}/video-intelligence`} />
                <PipelineRow
                  done={
                    stats.growthRunCompletedCount > 0 ||
                    stats.growthVideoReadyCount > 0 ||
                    stats.growthScheduledCount > 0
                  }
                  label="First Growth Run shipped"
                  href={`/projects/${params.id}/growth`}
                />
                <PipelineRow done={stats.winnerCount > 0} label="Winner(s) detected" href={`/projects/${params.id}/growth/winners`} />
                <PipelineRow done={stats.growthRunCompletedCount > 1} label="Compounding variants" href={`/projects/${params.id}/growth`} />
              </div>
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-2">
                  <Brain className="h-4 w-4 text-primary" />
                  <h2 className="text-base font-semibold tracking-tight">TrendWatch</h2>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${params.id}/trendwatch`}>
                    Open
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <p className="mt-2 text-sm text-muted-foreground">
                {trendhopSummary.freshCount > 0
                  ? `${trendhopSummary.freshCount} fresh hops · last run ${
                      trendhopSummary.lastRunAt ? formatRelativeTime(trendhopSummary.lastRunAt) : "never"
                    }`
                  : "No fresh trend hops. Run TrendWatch to scan today's viral patterns."}
              </p>
              {trendhopSummary.preview.length > 0 && (
                <ul className="mt-4 space-y-2 text-sm">
                  {trendhopSummary.preview.map((p) => (
                    <li key={p.id} className="flex items-center justify-between gap-3 rounded-md border border-border bg-background/70 px-3 py-2">
                      <span className="truncate">{p.trend_name}</span>
                      <Badge variant="outline" className="capitalize">
                        {p.platform.replace("_", " ")}
                      </Badge>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Project snapshot</h2>
                <p className="mt-1 text-sm text-muted-foreground">
                  The saved brief that guides Growth Run, TrendWatch, and content generation.
                </p>
              </div>
              <Button asChild variant="outline" size="sm" className="shrink-0">
                <Link href={`/projects/${params.id}/brief`}>
                  <FileText className="h-3.5 w-3.5" />
                  Edit
                </Link>
              </Button>
            </div>
            <dl className="mt-6 grid gap-4">
              <Row label="Niche" value={project.niche || "Not set"} />
              <Row label="Product URL" value={project.product_url || "Not set"} />
              <Row label="ICP" value={brief?.target_customer || "Not set"} />
              <Row label="Offer" value={brief?.offer || "Not set"} />
              <Row label="CTA" value={brief?.cta || "Not set"} />
            </dl>
          </div>
        </div>
      </div>
    </div>
  );
}

interface GrowthHealth {
  latestRun: {
    id: string;
    status: string;
    phase: string | null;
    createdAt: string;
  } | null;
  lastWinner: {
    id: string;
    name: string | null;
    thumbnailUrl: string | null;
  } | null;
  nextScheduled: { scheduledAt: string | null } | null;
  experimentCount: number;
}

function GrowthHealthPanel({
  projectId,
  health,
  stats,
}: {
  projectId: string;
  health: GrowthHealth;
  stats: { growthRunCompletedCount: number; growthVideoReadyCount: number; winnerCount: number };
}) {
  const healthLabel = health.latestRun?.status === "running"
    ? "Active"
    : health.latestRun?.status === "failed"
      ? "Attention"
      : stats.growthRunCompletedCount > 0
        ? "Healthy"
        : "Idle";
  const healthVariant: "default" | "success" | "destructive" | "secondary" =
    healthLabel === "Healthy"
      ? "success"
      : healthLabel === "Attention"
        ? "destructive"
        : healthLabel === "Active"
          ? "default"
          : "secondary";

  return (
    <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Rocket className="h-4 w-4 text-primary" />
          <h2 className="text-base font-semibold tracking-tight">Growth Health</h2>
        </div>
        <Badge variant={healthVariant}>{healthLabel}</Badge>
      </div>

      <div className="mt-5 grid grid-cols-3 gap-4">
        <HealthStat
          label="Active run"
          value={
            health.latestRun
              ? `${health.latestRun.phase ?? health.latestRun.status}`
              : "—"
          }
          detail={
            health.latestRun
              ? formatRelativeTime(health.latestRun.createdAt)
              : "No runs yet"
          }
        />
        <HealthStat
          label="Last winner"
          value={
            health.lastWinner
              ? health.lastWinner.name?.slice(0, 18) ?? "Winner"
              : "—"
          }
          detail={health.lastWinner ? "Compound it →" : "Mark a winner"}
          thumbnail={health.lastWinner?.thumbnailUrl ?? null}
        />
        <HealthStat
          label="Experiments"
          value={String(health.experimentCount)}
          detail={
            health.nextScheduled?.scheduledAt
              ? `Next ${formatRelativeTime(health.nextScheduled.scheduledAt)}`
              : "—"
          }
        />
      </div>

      <div className="mt-5 flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${projectId}/growth`}>
            <Rocket className="h-3.5 w-3.5" /> Growth Run
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${projectId}/growth/winners`}>
            <Trophy className="h-3.5 w-3.5" /> Winners
          </Link>
        </Button>
        <Button asChild variant="outline" size="sm">
          <Link href={`/projects/${projectId}/video-intelligence`}>
            <Video className="h-3.5 w-3.5" /> Video Intelligence
          </Link>
        </Button>
      </div>
    </div>
  );
}

function HealthStat({
  label,
  value,
  detail,
  thumbnail,
}: {
  label: string;
  value: string;
  detail?: string | null;
  thumbnail?: string | null;
}) {
  return (
    <div className="rounded-xl border border-border bg-background/60 p-3">
      <div className="flex items-center gap-2">
        {thumbnail ? (
          <img
            src={thumbnail}
            alt=""
            className="h-10 w-10 shrink-0 rounded-md object-cover"
          />
        ) : null}
        <div className="min-w-0">
          <div className="text-[10px] uppercase tracking-wider text-muted-foreground">{label}</div>
          <div className="mt-0.5 truncate text-lg font-semibold tracking-tight">{value}</div>
        </div>
      </div>
      {detail && <div className="mt-1 truncate text-[11px] text-muted-foreground">{detail}</div>}
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid gap-1 border-b border-border/70 pb-4 last:border-b-0 last:pb-0 sm:grid-cols-[132px_1fr] sm:gap-5">
      <dt className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">{label}</dt>
      <dd className="min-w-0 text-sm leading-6 text-foreground">{value}</dd>
    </div>
  );
}

function PipelineRow({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <Link
      href={href}
      className="group flex items-center gap-3 rounded-xl border border-border bg-background/70 px-3 py-2.5 transition-all hover:border-primary/30 hover:bg-primary/[0.03]"
    >
      <span
        className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${
          done
            ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
            : "border border-border bg-secondary text-muted-foreground"
        }`}
      >
        {done ? <Check className="h-3.5 w-3.5" /> : ""}
      </span>
      <span className={`min-w-0 flex-1 text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function SignalPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${
        done ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-background/70 text-muted-foreground"
      }`}
    >
      {done && <Check className="h-3 w-3" />}
      {label}
    </span>
  );
}

async function loadGrowthHealth(projectId: string): Promise<GrowthHealth> {
  if (!isSupabaseConfigured()) {
    return { latestRun: null, lastWinner: null, nextScheduled: null, experimentCount: 0 };
  }
  const supabase = createSupabaseServerClient();
  const [latestRunRes, lastWinnerRes, nextScheduledRes, experimentCountRes] = await Promise.all([
    supabase
      .from("growth_runs")
      .select("id, status, phase, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("winners")
      .select("id, created_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("schedule_items")
      .select("scheduled_for")
      .eq("project_id", projectId)
      .in("status", ["scheduled", "queued"])
      .order("scheduled_for", { ascending: true })
      .limit(1)
      .maybeSingle(),
    supabase
      .from("experiments")
      .select("id", { count: "exact", head: true })
      .eq("project_id", projectId),
  ]);

  return {
    latestRun: latestRunRes.data
      ? {
          id: latestRunRes.data.id,
          status: latestRunRes.data.status,
          phase: latestRunRes.data.phase ?? null,
          createdAt: latestRunRes.data.created_at,
        }
      : null,
    lastWinner: lastWinnerRes.data
      ? { id: lastWinnerRes.data.id, name: null, thumbnailUrl: null }
      : null,
    nextScheduled: nextScheduledRes.data
      ? { scheduledAt: nextScheduledRes.data.scheduled_for ?? null }
      : null,
    experimentCount: experimentCountRes.count ?? 0,
  };
}

async function loadTrendHopSummary(projectId: string) {
  if (!isSupabaseConfigured()) {
    return { freshCount: 0, lastRunAt: null as string | null, preview: [] as Array<{ id: string; trend_name: string; platform: string }> };
  }
  const supabase = createSupabaseServerClient();
  const [itemsRes, runRes] = await Promise.all([
    supabase
      .from("trendhop_items")
      .select("id, trend_name, platform")
      .eq("project_id", projectId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(3),
    supabase
      .from("trendhop_runs")
      .select("created_at, completed_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const items = itemsRes.data ?? [];
  return {
    freshCount: items.length,
    lastRunAt: runRes.data?.completed_at ?? runRes.data?.created_at ?? null,
    preview: items,
  };
}
