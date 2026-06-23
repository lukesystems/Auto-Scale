import Link from "next/link";
import { ArrowRight, Brain, FileText, FlaskConical, Layers, Lightbulb, Network, Package, Send, Shield, Trophy } from "lucide-react";
import { PageHeader } from "@/components/app/page-header";
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

  return (
    <div className="container py-10 space-y-8">
      <PageHeader
        badge={<Badge variant={project.status === "brief_saved" || project.status === "active" ? "success" : project.status === "brief_failed" ? "destructive" : "secondary"}>{project.status}</Badge>}
        title={project.name}
        description={project.niche || project.description || "Set your niche in the project brief to sharpen TrendWatch."}
        actions={
          <Button asChild variant="glow">
            <Link href={next.href}>
              {next.label}
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        }
      />

      <div className="grid lg:grid-cols-[2fr_1fr] gap-6">
        <div className="space-y-4">
          <div className="rounded-xl border border-primary/30 bg-gradient-to-br from-primary/[0.06] to-primary/[0.02] p-6 shadow-sm shadow-primary/5">
            <div className="text-xs uppercase tracking-widest text-primary font-semibold">Recommended next action</div>
            <h3 className="mt-2 font-display text-xl font-semibold tracking-tight">{next.label}</h3>
            <p className="mt-1 text-sm text-muted-foreground">{next.description}</p>
            <Button asChild className="mt-4" size="sm">
              <Link href={next.href}>Take action <ArrowRight className="h-3.5 w-3.5" /></Link>
            </Button>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
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
        </div>

        <div className="space-y-4">
          <div className="rounded-xl border border-border bg-card p-6">
            <h4 className="text-sm font-semibold tracking-tight">Project snapshot</h4>
            <dl className="mt-4 space-y-3 text-sm">
              <Row label="Niche" value={project.niche || "Not set"} />
              <Row label="Product URL" value={project.product_url || "Not set"} />
              <Row label="Last TrendWatch" value={stats.lastTrendwatch ? formatRelativeTime(stats.lastTrendwatch) : "Never"} />
              <Row label="ICP" value={brief?.target_customer || "Not set"} />
              <Row label="Offer" value={brief?.offer || "Not set"} />
              <Row label="CTA" value={brief?.cta || "Not set"} />
            </dl>
            <Button asChild variant="outline" size="sm" className="mt-5 w-full">
              <Link href={`/projects/${params.id}/brief`}>
                <FileText className="h-3.5 w-3.5" /> Edit brief
              </Link>
            </Button>
          </div>

          <div className="rounded-xl border border-border bg-card p-6">
            <h4 className="text-sm font-semibold tracking-tight">Pipeline</h4>
            <ul className="mt-4 space-y-2 text-sm">
              <PipelineRow done={Boolean(brief?.product_summary && brief?.target_customer)} label="Product Brief complete" href={`/projects/${params.id}/brief`} />
              <PipelineRow done={stats.sourceCount > 0} label="Sources gathered" href={`/projects/${params.id}/sources`} />
              <PipelineRow done={stats.insightCount > 0} label="TrendWatch run" href={`/projects/${params.id}/trendwatch`} />
              <PipelineRow done={stats.ideaCount > 0} label="Legacy ideas generated" href={`/projects/${params.id}/ideas`} />
              <PipelineRow done={stats.postCount > 0} label="Legacy posts drafted" href={`/projects/${params.id}/content`} />
              <PipelineRow done={stats.approvedCount > 0} label="Approved" href={`/projects/${params.id}/approval`} />
              <PipelineRow done={stats.scheduledCount > 0} label="Scheduled" href={`/projects/${params.id}/schedule`} />
              <PipelineRow done={stats.experimentCount > 0} label="Measured" href={`/projects/${params.id}/experiments`} />
              <PipelineRow done={stats.winnerCount > 0} label="Compounded" href={`/projects/${params.id}/winners`} />
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value, icon, highlight }: { label: string; value: number; icon: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-xl border p-4 transition-all duration-200 hover:shadow-sm ${highlight ? "border-primary/40 bg-primary/[0.04] shadow-sm shadow-primary/5" : "border-border bg-card hover:border-border/80"}`}>
      <div className="flex items-center justify-between text-muted-foreground">
        <span className="text-xs">{label}</span>
        <span className={highlight ? "text-primary" : ""}>{icon}</span>
      </div>
      <div className={`mt-2 text-2xl font-semibold tracking-tight ${highlight ? "text-primary" : ""}`}>{value}</div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-start gap-3">
      <dt className="text-muted-foreground w-24 text-xs uppercase tracking-wider">{label}</dt>
      <dd className="flex-1 text-sm text-foreground truncate">{value}</dd>
    </div>
  );
}

function PipelineRow({ done, label, href }: { done: boolean; label: string; href: string }) {
  return (
    <li>
      <Link href={href} className="group flex items-center gap-3 -mx-2 px-2 py-1.5 rounded-md hover:bg-secondary/60 transition-colors">
        <span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-semibold ${done ? "bg-primary text-primary-foreground" : "bg-secondary text-muted-foreground border border-border"}`}>
          {done ? "✓" : ""}
        </span>
        <span className={`flex-1 text-sm ${done ? "text-foreground" : "text-muted-foreground"}`}>{label}</span>
        <ArrowRight className="h-3.5 w-3.5 text-muted-foreground opacity-0 group-hover:opacity-100 transition-opacity" />
      </Link>
    </li>
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
