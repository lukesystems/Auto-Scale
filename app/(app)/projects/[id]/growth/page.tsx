import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { startGrowthRunAction, syncPostizAccountsAction } from "./actions";

interface GrowthIndexProps {
  params: { id: string };
}

/**
 * Growth Run hub.
 *
 * Lists past Growth Runs and exposes the "Run AutoScale" form: paste URL
 * (or reuse the saved Product Brief) and start a closed loop. Per the
 * direction: minimum founder input, maximum loop closure.
 */
export default async function GrowthIndex({ params }: GrowthIndexProps) {
  const projectId = params.id;
  if (!isSupabaseConfigured()) {
    return (
      <div className="p-6 text-sm text-muted-foreground">
        Supabase is not configured. Add credentials to start a Growth Run.
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const [runs, accounts, project] = await Promise.all([
    supabase
      .from("growth_runs")
      .select("id, status, phase, trigger, created_at, started_at, completed_at, error")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("connected_accounts").select("id, platform, handle, status").eq("project_id", projectId),
    supabase.from("projects").select("name, product_url").eq("id", projectId).single(),
  ]);

  const accountCount = accounts.data?.length ?? 0;
  const byPlatform = (accounts.data ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.platform] = (acc[a.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">Growth Runs</h1>
        <p className="text-sm text-muted-foreground max-w-2xl">
          A Growth Run is one full closed loop for {project.data?.name ?? "this project"}:
          product brief → video trend report → strategy → loadout → video concepts →
          scripts → storyboards → assets → approval → multi-account scheduling → tracking →
          compound. Click Run AutoScale, then approve the videos.
        </p>
        <div className="flex flex-wrap items-center gap-2 rounded-md border bg-muted/40 px-3 py-2 text-xs">
          <span className="font-medium text-muted-foreground">Product URL:</span>
          {project.data?.product_url ? (
            <a
              href={project.data.product_url}
              target="_blank"
              rel="noopener noreferrer"
              className="font-mono text-foreground underline break-all"
            >
              {project.data.product_url}
            </a>
          ) : (
            <span className="text-amber-600 dark:text-amber-400">
              No product URL saved.{" "}
              <Link href={`/projects/${projectId}/brief`} className="underline">
                Set it in the Brief
              </Link>{" "}
              so the run can understand your product.
            </span>
          )}
        </div>
      </header>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Connected accounts</h2>
            <p className="text-xs text-muted-foreground">
              {accountCount === 0
                ? "No accounts linked yet. Sync from Postiz to enable multi-account posting."
                : `${accountCount} account${accountCount === 1 ? "" : "s"} — ${Object.entries(byPlatform)
                    .map(([p, n]) => `${n} ${p}`)
                    .join(", ")}`}
            </p>
          </div>
          <form action={syncPostizAccountsAction}>
            <input type="hidden" name="projectId" value={projectId} />
            <button
              type="submit"
              className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
            >
              Sync Postiz accounts
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-4">
        <h2 className="text-sm font-semibold">Run AutoScale</h2>
        <form action={startGrowthRunAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="projectId" value={projectId} />

          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target platforms
            </legend>
            <div className="flex flex-wrap gap-2">
              {(["tiktok", "instagram", "youtube"] as const).map((p) => (
                <label key={p} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
                  <input type="checkbox" name="targetPlatforms" value={p} defaultChecked />
                  {p}
                </label>
              ))}
            </div>
          </fieldset>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Approval mode
            </span>
            <select
              name="approvalMode"
              defaultValue="manual"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="manual">Manual (review each video)</option>
              <option value="per_format">Per-format (auto-approve slide / founder / pain)</option>
              <option value="autopilot">Full autopilot</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Posting aggressiveness
            </span>
            <select
              name="postingAggressiveness"
              defaultValue="balanced"
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="conservative">Conservative (1/day per account)</option>
              <option value="balanced">Balanced (2/day per account)</option>
              <option value="aggressive">Aggressive (4/day per account)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Duration (days)
            </span>
            <input
              type="number"
              name="durationDays"
              min={1}
              max={60}
              defaultValue={7}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Concept count
            </span>
            <input
              type="number"
              name="conceptTargetCount"
              min={3}
              max={30}
              defaultValue={12}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
          </label>

          <div className="sm:col-span-2">
            <button
              type="submit"
              className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
            >
              Run AutoScale
            </button>
            <p className="mt-2 text-xs text-muted-foreground">
              This generates the trend report, strategy, concepts, scripts, storyboards, asset queue,
              and per-account captions in one pass. Video pixel rendering + posting happen after
              approval.
            </p>
          </div>
        </form>
      </section>

      <section className="space-y-2">
        <h2 className="text-sm font-semibold">Past runs</h2>
        {!runs.data?.length ? (
          <p className="text-sm text-muted-foreground">No runs yet.</p>
        ) : (
          <ul className="divide-y rounded-lg border bg-card">
            {runs.data.map((run) => (
              <li key={run.id} className="flex items-center justify-between gap-4 px-4 py-3 text-sm">
                <div className="space-y-0.5">
                  <Link
                    href={`/projects/${projectId}/growth/${run.id}`}
                    className="font-medium hover:underline"
                  >
                    {new Date(run.created_at).toLocaleString()}
                  </Link>
                  <div className="text-xs text-muted-foreground">
                    {run.trigger} • phase: {run.phase} • status: {run.status}
                    {run.error ? ` • error: ${run.error.slice(0, 80)}` : null}
                  </div>
                </div>
                <Link
                  href={`/projects/${projectId}/growth/${run.id}`}
                  className="text-xs underline text-muted-foreground hover:text-foreground"
                >
                  Open
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
