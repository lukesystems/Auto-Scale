import "server-only";
import { createSupabaseAdminClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { runTrendHop } from "./run";

/**
 * Run any trendwatch_schedules whose next_run_at is due. Intended to be wired
 * to a Vercel Cron or Supabase scheduled function:
 *
 *   // app/api/cron/trendhop/route.ts
 *   import { runDueTrendHops } from "@/services/trendhop/schedule";
 *   export async function GET() { return Response.json(await runDueTrendHops()); }
 *
 * Add to vercel.json:
 *   { "crons": [{ "path": "/api/cron/trendhop", "schedule": "0 * * * *" }] }
 */
export async function runDueTrendHops(): Promise<{
  triggered: number;
  failed: number;
  skipped: number;
}> {
  if (!isSupabaseConfigured()) return { triggered: 0, failed: 0, skipped: 0 };

  const supabase = createSupabaseAdminClient();
  const now = new Date().toISOString();

  const { data: due } = await supabase
    .from("trendwatch_schedules")
    .select("id, project_id, cadence_days")
    .eq("enabled", true)
    .lte("next_run_at", now);

  if (!due || due.length === 0) return { triggered: 0, failed: 0, skipped: 0 };

  let triggered = 0;
  let failed = 0;

  for (const sched of due) {
    const result = await runTrendHop({ projectId: sched.project_id, trigger: "scheduled" });
    if (result.ok) triggered += 1;
    else failed += 1;

    const next = new Date();
    next.setUTCDate(next.getUTCDate() + sched.cadence_days);
    await supabase
      .from("trendwatch_schedules")
      .update({
        next_run_at: next.toISOString(),
        last_run_id: result.runId,
        updated_at: new Date().toISOString(),
      })
      .eq("id", sched.id);
  }

  return { triggered, failed, skipped: 0 };
}
