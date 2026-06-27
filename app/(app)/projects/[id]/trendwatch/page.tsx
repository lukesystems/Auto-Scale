import Link from "next/link";
import { Brain, Calendar, Clock, ExternalLink, Rocket, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { PageHeader, EmptyState } from "@/components/app/page-header";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { formatRelativeTime } from "@/lib/utils";
import { TrendHopItemCard } from "@/components/evidence/trendhop-item-card";
import {
  dismissTrendHopAction,
  runTrendHopAction,
  sendTrendHopToGrowthAction,
  upsertTrendHopScheduleAction,
} from "./actions";

interface PageProps {
  params: { id: string };
}

export const metadata = { title: "TrendWatch — Trend Hops" };

export default async function TrendWatchTrendHopsPage({ params }: PageProps) {
  const { runs, items, schedule } = await loadData(params.id);
  const lastRun = runs[0];

  return (
    <div className="container space-y-8 py-8">
      <PageHeader
        title="TrendWatch — Trend Hops"
        description="Scan today's trending short-form content and propose video concepts that hop on each trend to organically promote your product."
        actions={
          <form action={runTrendHopAction}>
            <input type="hidden" name="projectId" value={params.id} />
            <Button type="submit" variant="glow">
              <Sparkles className="h-4 w-4" /> Run now
            </Button>
          </form>
        }
      />

      <section className="grid gap-4 sm:grid-cols-[1fr_280px]">
        <div className="rounded-xl border border-border bg-card p-5">
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="font-semibold tracking-tight">Latest run</h3>
              <p className="text-xs text-muted-foreground">
                {lastRun
                  ? `${formatRelativeTime(lastRun.completed_at ?? lastRun.created_at)} • ${lastRun.item_count} hops`
                  : "No runs yet — kick one off."}
              </p>
            </div>
            {lastRun && (
              <Badge
                variant={
                  lastRun.status === "success"
                    ? "success"
                    : lastRun.status === "failed"
                      ? "destructive"
                      : "secondary"
                }
              >
                {lastRun.status}
              </Badge>
            )}
          </div>
        </div>

        <form
          action={upsertTrendHopScheduleAction}
          className="rounded-xl border border-border bg-card p-5 space-y-3"
        >
          <input type="hidden" name="projectId" value={params.id} />
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Calendar className="h-4 w-4" /> Schedule
          </div>
          <label className="block space-y-1">
            <span className="text-[11px] uppercase tracking-wider text-muted-foreground">
              Cadence (days)
            </span>
            <select
              name="cadenceDays"
              defaultValue={schedule?.cadence_days ?? 7}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value={3}>Every 3 days</option>
              <option value={7}>Every 7 days</option>
              <option value={14}>Every 14 days</option>
            </select>
          </label>
          <label className="flex items-center gap-2 text-xs text-muted-foreground">
            <input type="checkbox" name="enabled" defaultChecked={schedule?.enabled ?? true} />
            Enabled
          </label>
          <p className="text-[11px] text-muted-foreground">
            <Clock className="inline h-3 w-3" /> Next:{" "}
            {schedule?.next_run_at
              ? new Date(schedule.next_run_at).toLocaleString()
              : "not scheduled"}
          </p>
          <Button type="submit" variant="outline" size="sm" className="w-full">
            Save schedule
          </Button>
        </form>
      </section>

      <section className="space-y-3">
        <h3 className="font-semibold tracking-tight">Fresh hops ({items.length})</h3>
        {items.length === 0 ? (
          <EmptyState
            icon={<Brain className="h-5 w-5" />}
            title="No trend hops yet"
            description="Click Run now to scan trending TikTok / Reels / Shorts content and get organic video ideas that fit this product."
            action={
              <form action={runTrendHopAction}>
                <input type="hidden" name="projectId" value={params.id} />
                <Button type="submit" variant="glow">
                  <Sparkles className="h-4 w-4" /> Run now
                </Button>
              </form>
            }
          />
        ) : (
          <div className="grid gap-3 lg:grid-cols-2">
            {items.map((item) => (
              <TrendHopItemCard key={item.id} projectId={params.id} item={item} />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

async function loadData(projectId: string) {
  if (!isSupabaseConfigured()) {
    return { runs: [], items: [], schedule: null };
  }
  const supabase = createSupabaseServerClient();
  const [runsRes, itemsRes, schedRes] = await Promise.all([
    supabase
      .from("trendhop_runs")
      .select("id, status, item_count, created_at, completed_at")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(10),
    supabase
      .from("trendhop_items")
      .select(
        "id, platform, trend_name, why_hot, product_angle, suggested_hook, suggested_concept, references, recency_score, confidence, dismissed_at, promoted_video_concept_id, created_at"
      )
      .eq("project_id", projectId)
      .is("dismissed_at", null)
      .order("created_at", { ascending: false })
      .limit(40),
    supabase
      .from("trendwatch_schedules")
      .select("cadence_days, enabled, next_run_at")
      .eq("project_id", projectId)
      .maybeSingle(),
  ]);

  return {
    runs: runsRes.data ?? [],
    items: itemsRes.data ?? [],
    schedule: schedRes.data,
  };
}
