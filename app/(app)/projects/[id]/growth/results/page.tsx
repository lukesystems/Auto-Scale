import { notFound } from "next/navigation";
import Link from "next/link";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { aggregateGrowthResults } from "@/services/growth-results/aggregate";

interface PageProps {
  params: { id: string };
}

export default async function GrowthResultsPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) return notFound();
  const summary = await aggregateGrowthResults(params.id);

  return (
    <div className="space-y-8 p-6 max-w-4xl">
      <header>
        <Link href={`/projects/${params.id}/growth`} className="text-xs underline text-muted-foreground">
          ← Growth Runs
        </Link>
        <h1 className="text-2xl font-semibold mt-2">Growth Graph</h1>
        <p className="text-sm text-muted-foreground">
          What brought users, what worked, and what AutoScale recommends next.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-3">
        <StatCard label="Videos generated" value={summary.videosGenerated} />
        <StatCard label="Scheduled" value={summary.videosScheduled} />
        <StatCard label="Posted" value={summary.videosPosted} />
        <StatCard label="Link clicks" value={summary.totalClicks} />
        <StatCard label="Signups" value={summary.totalSignups} />
        <StatCard label="Demo-intent links" value={summary.demoCtaClicks} />
      </div>

      <section className="rounded-xl border bg-card p-5">
        <h2 className="text-sm font-semibold mb-2">Next actions</h2>
        <ul className="list-disc pl-5 text-sm space-y-1">
          {summary.recommendations.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <ListSection title="Top formats" items={summary.topFingerprints.map((f) => `${f.name} (${f.status}, ${(f.confidence * 100).toFixed(0)}%)`)} />
        <ListSection title="Winners" items={summary.winners.map((w) => `${w.diagnosis} → ${w.nextAction}`)} empty="No winners yet." />
        <ListSection title="Losers" items={summary.losers.map((l) => l.diagnosis)} empty="No losers flagged." />
        <ListSection
          title="Compound actions"
          items={summary.compoundActions.map((c) => `${c.fingerprintName}: ${c.action}`)}
          empty="Run Compound after metrics."
        />
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href={`/projects/${params.id}/growth/settings`} className="underline">
          Growth settings
        </Link>
        {" · "}
        Record metrics on each scheduled post in the Growth Run detail page, or import CSV (coming soon).
      </p>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border bg-card p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-semibold mt-1">{value}</p>
    </div>
  );
}

function ListSection({ title, items, empty }: { title: string; items: string[]; empty?: string }) {
  return (
    <section className="rounded-xl border bg-card p-4">
      <h2 className="text-sm font-semibold mb-2">{title}</h2>
      {items.length ? (
        <ul className="text-xs space-y-1 text-muted-foreground">
          {items.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{empty ?? "None"}</p>
      )}
    </section>
  );
}
