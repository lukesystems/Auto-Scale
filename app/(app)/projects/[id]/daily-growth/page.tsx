import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { generateDailyGrowthPack } from "@/services/daily-growth-pack/generate";

interface PageProps {
  params: { id: string };
}

export default async function DailyGrowthPackPage({ params }: PageProps) {
  if (!isSupabaseConfigured()) return notFound();

  const pack = await generateDailyGrowthPack(params.id);
  const supabase = createSupabaseServerClient();
  const { data: items } = await supabase
    .from("daily_growth_pack_items")
    .select("item_type, title, body")
    .eq("pack_id", pack.packId)
    .order("priority", { ascending: false });

  const grouped = {
    videos: (items ?? []).filter((i) => i.item_type === "ready_video" || i.item_type === "queued_video"),
    hooks: (items ?? []).filter((i) => i.item_type === "trend_hook"),
    winners: (items ?? []).filter((i) => i.item_type === "winner_variant"),
    test: (items ?? []).filter((i) => i.item_type === "pattern_to_test"),
    avoid: (items ?? []).filter((i) => i.item_type === "format_to_avoid"),
    posting: (items ?? []).filter((i) => i.item_type === "posting_recommendation"),
  };

  return (
    <div className="space-y-8 max-w-4xl">
      <div>
        <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">Daily operating surface</p>
        <h1 className="text-2xl font-semibold tracking-tight">Daily Growth Pack</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Pack for {pack.packDate} — generated from your latest trend report, formats, and experiment results.
        </p>
      </div>

      <section className="rounded-xl border border-border bg-card p-5">
        <h2 className="text-sm font-semibold mb-2">Posting recommendation</h2>
        <p className="text-sm text-foreground/90">{pack.postingRecommendation}</p>
      </section>

      <div className="grid gap-6 md:grid-cols-2">
        <PackSection title="Ready / queued videos" items={grouped.videos} empty="No videos ready yet — run a Growth Run." />
        <PackSection title="Trend-backed hooks" items={grouped.hooks} empty="Import video evidence and run VideoTrend first." />
        <PackSection title="Winner to scale" items={grouped.winners} empty="No winners yet — record metrics and run Compound." />
        <PackSection title="Pattern to test" items={grouped.test} empty="No active format experiments." />
        <PackSection title="Format to avoid" items={grouped.avoid} empty="No killed formats — good." />
      </div>

      <p className="text-xs text-muted-foreground">
        <Link href={`/projects/${params.id}/growth`} className="underline hover:text-foreground">
          Open Growth Run
        </Link>
        {" · "}
        <Link href={`/projects/${params.id}/video-intelligence`} className="underline hover:text-foreground">
          Add reference video URLs
        </Link>
      </p>
    </div>
  );
}

function PackSection({
  title,
  items,
  empty,
}: {
  title: string;
  items: Array<{ title: string; body: string | null; item_type: string }>;
  empty: string;
}) {
  return (
    <section className="rounded-xl border border-border bg-card p-4">
      <h2 className="text-sm font-semibold mb-3">{title}</h2>
      {items.length === 0 ? (
        <p className="text-sm text-muted-foreground">{empty}</p>
      ) : (
        <ul className="space-y-2">
          {items.map((item, i) => (
            <li key={i} className="text-sm border-l-2 border-primary/40 pl-3">
              <p className="font-medium">{item.title}</p>
              {item.body ? <p className="text-muted-foreground text-xs mt-0.5">{item.body}</p> : null}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
