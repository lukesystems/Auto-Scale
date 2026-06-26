import Link from "next/link";
import {
  ArrowRight,
  Brain,
  Check,
  FileText,
  FlaskConical,
  Layers,
  Lightbulb,
  Network,
  Send,
  Shield,
  Sparkles,
  Trophy,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatRelativeTime } from "@/lib/utils";
import { getProductBrief, getProjectOr404, getProjectStats } from "./queries";

interface PageProps { params: { id: string } }

export async function generateMetadata({ params }: PageProps) {
  const project = await getProjectOr404(params.id);
  return { title: project.name };
}

export default async function ProjectOverviewPage({ params }: PageProps) {
  const [project, brief, stats] = await Promise.all([
    getProjectOr404(params.id),
    getProductBrief(params.id),
    getProjectStats(params.id),
  ]);

  const nextRaw = computeNextAction({ brief, stats });
  const next = { ...nextRaw, href: `/projects/${params.id}/${nextRaw.href}` };
  const statusIsHealthy = project.status === "brief_saved" || project.status === "active";

  return (
    <div className="bg-[linear-gradient(180deg,hsl(var(--secondary)/0.7)_0%,hsl(var(--background))_280px)]">
      <div className="container space-y-7 py-8">
        <section className="relative overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-[0_22px_70px_-48px_rgba(15,23,42,0.55)] sm:p-8">
          <div className="absolute inset-y-0 right-0 hidden w-1/2 bg-[radial-gradient(circle_at_70%_35%,hsl(var(--primary)/0.18),transparent_34%),linear-gradient(135deg,transparent,hsl(var(--secondary)/0.82))] lg:block" />
          <div className="relative flex flex-col gap-7 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-3xl">
              <Badge variant={statusIsHealthy ? "success" : project.status === "brief_failed" ? "destructive" : "secondary"}>
                {project.status}
              </Badge>
              <h1 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
                {project.name}
              </h1>
              <p className="mt-3 max-w-2xl text-base leading-7 text-muted-foreground md:text-lg">
                {project.niche || project.description || "Set your niche in the project brief to sharpen TrendWatch."}
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                <SignalPill label="Brief" done={Boolean(brief?.product_summary && brief?.target_customer)} />
                <SignalPill label="Sources" done={stats.sourceCount > 0} />
                <SignalPill label="Insights" done={stats.insightCount > 0} />
                <SignalPill label="Distribution" done={stats.scheduledCount > 0} />
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
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              <StatCard label="Sources analyzed" value={stats.sourceCount} icon={<Network className="h-4 w-4" />} />
              <StatCard label="Insights" value={stats.insightCount} icon={<Brain className="h-4 w-4" />} />
              <StatCard label="Hooks" value={stats.hookCount} icon={<Lightbulb className="h-4 w-4" />} />
              <StatCard label="Legacy ideas" value={stats.ideaCount} icon={<Lightbulb className="h-4 w-4" />} />
              <StatCard label="Legacy posts" value={stats.postCount} icon={<Layers className="h-4 w-4" />} />
              <StatCard label="Approved" value={stats.approvedCount} icon={<Shield className="h-4 w-4" />} />
              <StatCard label="Scheduled" value={stats.scheduledCount} icon={<Send className="h-4 w-4" />} />
              <StatCard label="Experiments" value={stats.experimentCount} icon={<FlaskConical className="h-4 w-4" />} />
              <StatCard label="Winners" value={stats.winnerCount} icon={<Trophy className="h-4 w-4" />} highlight />
            </div>

            <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <h2 className="text-base font-semibold tracking-tight">Evidence chain</h2>
                  <p className="mt-1 text-sm text-muted-foreground">Keep every idea tied to sources, insights, and measured outcomes.</p>
                </div>
                <Button asChild variant="outline" size="sm">
                  <Link href={`/projects/${params.id}/sources`}>
                    Sources
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </Button>
              </div>
              <div className="mt-5 grid gap-2 sm:grid-cols-2">
                <PipelineRow done={Boolean(brief?.product_summary && brief?.target_customer)} label="Product Brief complete" href={`/projects/${params.id}/brief`} />
                <PipelineRow done={stats.sourceCount > 0} label="Sources gathered" href={`/projects/${params.id}/sources`} />
                <PipelineRow done={stats.insightCount > 0} label="TrendWatch run" href={`/projects/${params.id}/trendwatch`} />
                <PipelineRow done={stats.ideaCount > 0} label="Legacy ideas generated" href={`/projects/${params.id}/ideas`} />
                <PipelineRow done={stats.postCount > 0} label="Legacy posts drafted" href={`/projects/${params.id}/content`} />
                <PipelineRow done={stats.approvedCount > 0} label="Approved" href={`/projects/${params.id}/approval`} />
                <PipelineRow done={stats.scheduledCount > 0} label="Scheduled" href={`/projects/${params.id}/schedule`} />
                <PipelineRow done={stats.experimentCount > 0} label="Measured" href={`/projects/${params.id}/experiments`} />
                <PipelineRow done={stats.winnerCount > 0} label="Compounded" href={`/projects/${params.id}/winners`} />
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-6 shadow-sm">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold tracking-tight">Project snapshot</h2>
                <p className="mt-1 text-sm text-muted-foreground">The saved brief that guides discovery, TrendWatch, and content generation.</p>
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
              <Row label="Last TrendWatch" value={stats.lastTrendwatch ? formatRelativeTime(stats.lastTrendwatch) : "Never"} />
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

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`group rounded-2xl border p-4 transition-all duration-200 hover:-translate-y-0.5 hover:shadow-md ${highlight ? "border-primary/35 bg-primary/[0.05] shadow-sm shadow-primary/10" : "border-border bg-card hover:border-primary/25"}`}>
      <div className="flex items-center justify-between gap-3 text-muted-foreground">
        <span className="text-xs font-medium">{label}</span>
        <span className={`inline-flex h-8 w-8 items-center justify-center rounded-lg border ${highlight ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-secondary/60 group-hover:text-primary"}`}>{icon}</span>
      </div>
      <div className={`mt-3 text-3xl font-semibold tracking-tight ${highlight ? "text-primary" : ""}`}>{value}</div>
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
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-border bg-background/70 px-3 py-2.5 transition-all hover:border-primary/30 hover:bg-primary/[0.03]">
      <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[10px] font-semibold ${done ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20" : "border border-border bg-secondary text-muted-foreground"}`}>
        {done ? <Check className="h-3.5 w-3.5" /> : ""}
      </span>
      <span className={`min-w-0 flex-1 text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
      <ArrowRight className="h-3.5 w-3.5 shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100" />
    </Link>
  );
}

function SignalPill({ label, done }: { label: string; done: boolean }) {
  return (
    <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium ${done ? "border-primary/20 bg-primary/10 text-primary" : "border-border bg-background/70 text-muted-foreground"}`}>
      {done && <Check className="h-3 w-3" />}
      {label}
    </span>
  );
}

function computeNextAction({
  brief,
  stats,
}: {
  brief: { product_summary: string | null; target_customer: string | null } | null;
  stats: { sourceCount: number; insightCount: number; ideaCount: number; postCount: number; approvedCount: number; scheduledCount: number; experimentCount: number; winnerCount: number };
}): { label: string; description: string; href: string } {
  // Hrefs are returned as relative segments; the caller composes the project path.
  if (!brief?.product_summary || !brief?.target_customer) {
    return {
      label: "Complete the product brief",
      description: "Define the ICP, pain, offer, and CTA so TrendWatch and Content Conveyor stay on-target.",
      href: "brief",
    };
  }
  if (stats.winnerCount > 0) {
    return { label: "Compound your winners", description: "Turn what brought users into stronger video variants.", href: "winners" };
  }
  return {
    label: "Start a Growth Run",
    description: "Find the formats worth scaling, ship video experiments, and begin tracking what brings users.",
    href: "growth",
  };
}
