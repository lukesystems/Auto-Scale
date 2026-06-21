import { PageHeader } from "@/components/app/page-header";
import { getProductBrief, getProjectOr404 } from "../queries";
import { BriefForm } from "./brief-form";
import type { BriefCompetitorEntry } from "@/services/intelligence/memory/merge-brief-competitors";

interface PageProps { params: { id: string } }

export const metadata = { title: "Product brief" };

function parseCompetitorEntries(value: unknown): BriefCompetitorEntry[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (item): item is BriefCompetitorEntry =>
      !!item && typeof item === "object" && "name" in item && "verification" in item
  );
}

function confidenceLabel(level: string): string {
  return level === "high" ? "High confidence" : level === "medium" ? "Medium confidence" : "Low confidence";
}

function MarketIntelligencePanel({ entries }: { entries: BriefCompetitorEntry[] }) {
  const verified = entries.filter((e) => e.verification === "verified");
  const unverifiedCount = entries.length - verified.length;
  if (!verified.length) return null;

  return (
    <section className="rounded-lg border border-border bg-card p-5">
      <div className="flex items-center justify-between gap-3">
        <h2 className="font-semibold tracking-tight">Verified competitors</h2>
        <span className="text-xs text-muted-foreground">
          {verified.length} evidence-backed{unverifiedCount ? ` · ${unverifiedCount} unverified guess${unverifiedCount === 1 ? "" : "es"}` : ""}
        </span>
      </div>
      <p className="mt-1 text-xs text-muted-foreground">
        Promoted from deep discovery. Each is backed by public sources found by AutoScale.
      </p>
      <ul className="mt-4 space-y-3">
        {verified.map((c) => (
          <li key={c.name} className="rounded-md border border-border bg-background/40 p-3">
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-medium">{c.name}</span>
              <span className="rounded-full bg-emerald-500/15 px-2 py-0.5 text-[11px] font-medium text-emerald-600 dark:text-emerald-400">
                Verified · {c.evidence_count} source{c.evidence_count === 1 ? "" : "s"}
              </span>
              <span className="text-[11px] text-muted-foreground">{confidenceLabel(c.confidence)}</span>
            </div>
            {c.reason ? <p className="mt-1 text-sm text-muted-foreground">{c.reason}</p> : null}
            {c.evidence_urls.length ? (
              <div className="mt-2 flex flex-wrap gap-2">
                {c.evidence_urls.map((url, i) => (
                  <a
                    key={url}
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-[11px] text-primary underline underline-offset-2"
                  >
                    Source {i + 1}
                  </a>
                ))}
              </div>
            ) : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

export default async function BriefPage({ params }: PageProps) {
  const [project, brief] = await Promise.all([
    getProjectOr404(params.id),
    getProductBrief(params.id),
  ]);

  return (
    <div className="container py-10 max-w-4xl space-y-8">
      <PageHeader
        title="Product brief"
        description={`Sharpens TrendWatch and Content Conveyor for ${project.name}. Use AI to seed it, then refine.`}
      />

      <MarketIntelligencePanel entries={parseCompetitorEntries(brief?.likely_competitors)} />

      <BriefForm
        projectId={params.id}
        initial={{
          source_url: brief?.source_url ?? project.product_url ?? "",
          product_name: brief?.product_name ?? project.name ?? "",
          one_line_description: brief?.one_line_description ?? brief?.product_summary ?? project.description ?? "",
          category: brief?.category ?? project.niche ?? "",
          product_type: brief?.product_type ?? "",
          product_summary: brief?.product_summary ?? "",
          what_it_does: brief?.what_it_does ?? brief?.product_summary ?? "",
          target_customer: brief?.target_customer ?? "",
          target_audience: jsonLines(brief?.target_audience),
          primary_pain: brief?.primary_pain ?? "",
          user_pain_points: jsonLines(brief?.user_pain_points),
          core_promise: brief?.core_promise ?? "",
          key_features: jsonLines(brief?.key_features),
          key_benefits: jsonLines(brief?.key_benefits),
          offer: brief?.offer ?? "",
          cta: brief?.cta ?? "",
          competitors: jsonLines(brief?.competitors),
          alternative_solutions: jsonLines(brief?.alternative_solutions),
          market_category: brief?.market_category ?? "",
          content_angles: jsonLines(brief?.content_angles),
          platform_recommendations: platformLines(brief?.platform_recommendations),
          cta_suggestions: jsonLines(brief?.cta_suggestions),
          founder_led_opportunities: jsonLines(brief?.founder_led_opportunities),
          positioning_gaps: jsonLines(brief?.positioning_gaps),
          extraction_notes: jsonLines(brief?.extraction_notes),
          brand_voice: brief?.brand_voice ?? "",
          content_pillars: Array.isArray(brief?.content_pillars) ? (brief?.content_pillars as string[]).join("\n") : "",
          positioning_angles: Array.isArray(brief?.positioning_angles) ? (brief?.positioning_angles as string[]).join("\n") : "",
        }}
      />
    </div>
  );
}

function jsonLines(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "name" in item) return String(item.name);
      return "";
    })
    .filter(Boolean)
    .join("\n");
}

function platformLines(value: unknown): string {
  if (!Array.isArray(value)) return "";
  return value
    .map((item) => {
      if (typeof item === "string") return item;
      if (item && typeof item === "object" && "platform" in item && "reason" in item) {
        return `${String(item.platform)}: ${String(item.reason)}`;
      }
      return "";
    })
    .filter(Boolean)
    .join("\n");
}
