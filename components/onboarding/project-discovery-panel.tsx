"use client";

import { Badge } from "@/components/ui/badge";
import type { AutoBrief } from "@/services/autobrief/schema";
import { LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import type { AutoBriefProgressState } from "@/lib/autobrief/progress-types";
import type { GrowthRunProgressState } from "@/hooks/use-growth-run-progress";

interface ProjectDiscoveryPanelProps {
  brief: AutoBrief | null;
  autobriefProgress: AutoBriefProgressState | null;
  growthProgress: GrowthRunProgressState | null;
}

export function ProjectDiscoveryPanel({
  brief,
  autobriefProgress,
  growthProgress,
}: ProjectDiscoveryPanelProps) {
  if (!brief) {
    return (
      <div className="rounded-xl border border-border bg-card/60 p-5 space-y-4 h-full">
        <header>
          <h3 className="font-semibold text-sm">What we&apos;re discovering</h3>
          <p className="text-xs text-muted-foreground mt-1">
            Product signals will appear here as we read your site.
          </p>
        </header>
        {autobriefProgress && autobriefProgress.events.length > 0 && (
          <ul className="space-y-2 text-xs text-muted-foreground max-h-[420px] overflow-y-auto">
            {autobriefProgress.events.slice(-12).map((event) => (
              <li key={event.id} className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
                {event.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }

  const confidencePct = Math.round(brief.confidence_score * 100);

  return (
    <div className="rounded-xl border border-border bg-card/60 p-5 space-y-5 h-full max-h-[80vh] overflow-y-auto">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="font-semibold">{brief.product_name}</h3>
          <Badge variant={brief.confidence_score >= LOW_CONFIDENCE_THRESHOLD ? "success" : "secondary"}>
            {confidencePct}% confidence
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground">{brief.one_line_description || brief.product_summary}</p>
        <p className="text-xs text-muted-foreground">
          Saved internally — this is what AutoScale learned about your product.
        </p>
      </header>

      <Section title="Product">
        <p>{brief.what_it_does || brief.product_summary}</p>
        <Meta label="Category" value={brief.category || brief.niche} />
        <Meta label="Type" value={brief.product_type} />
      </Section>

      <Section title="Audience & pain">
        <p>{brief.target_customer}</p>
        <List items={brief.user_pain_points.length ? brief.user_pain_points : [brief.primary_pain]} />
        <Meta label="Core promise" value={brief.core_promise} />
      </Section>

      <Section title="Features & benefits">
        <List title="Features" items={brief.key_features} />
        <List title="Benefits" items={brief.key_benefits} />
      </Section>

      <Section title="Competitors & alternatives">
        {brief.suggested_competitors.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {brief.suggested_competitors.map((c) => (
              <li key={c.name} className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <p className="font-medium">{c.name}</p>
                <p className="text-muted-foreground mt-0.5">{c.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">No competitors inferred yet.</p>
        )}
        <List title="Alternatives users already use" items={brief.alternative_solutions} />
      </Section>

      <Section title="Sources to watch">
        {brief.suggested_sources.length > 0 ? (
          <ul className="space-y-2 text-xs">
            {brief.suggested_sources.map((s, i) => (
              <li key={`${s.platform}-${i}`} className="rounded-md border border-border/50 bg-background/40 px-3 py-2">
                <p className="font-medium">{s.platform ?? "Source"}</p>
                {s.url ? <p className="text-primary/80 truncate">{s.url}</p> : null}
                <p className="text-muted-foreground mt-0.5">{s.reason}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-xs text-muted-foreground">Sources will populate after deeper discovery runs.</p>
        )}
      </Section>

      <Section title="Distribution strategy">
        <List
          title="Platforms"
          items={brief.platform_recommendations.map((p) => `${p.platform}: ${p.reason}`)}
        />
        <List title="Content angles" items={brief.content_angles.length ? brief.content_angles : brief.positioning_angles} />
        <List title="Content pillars" items={brief.content_pillars} />
        <List title="Founder-led opportunities" items={brief.founder_led_opportunities} />
        <List title="Positioning gaps" items={brief.positioning_gaps} />
      </Section>

      <Section title="AI reasoning">
        <List items={brief.extraction_notes} />
        {brief.missing_information.length > 0 && (
          <>
            <p className="text-xs font-medium text-amber-600 dark:text-amber-500 mt-2">Still unclear</p>
            <List items={brief.missing_information} />
          </>
        )}
      </Section>

      {growthProgress && growthProgress.status === "running" && (
        <Section title="Growth Run">
          <p className="text-xs">{growthProgress.currentMessage}</p>
        </Section>
      )}
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</h4>
      <div className="space-y-2 text-sm">{children}</div>
    </section>
  );
}

function Meta({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <p className="text-xs">
      <span className="font-medium text-foreground">{label}: </span>
      <span className="text-muted-foreground">{value}</span>
    </p>
  );
}

function List({ title, items }: { title?: string; items: string[] }) {
  const filtered = items.filter(Boolean);
  if (!filtered.length) return null;
  return (
    <div>
      {title ? <p className="text-xs font-medium mb-1">{title}</p> : null}
      <ul className="list-disc pl-4 text-xs text-muted-foreground space-y-0.5">
        {filtered.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </div>
  );
}
