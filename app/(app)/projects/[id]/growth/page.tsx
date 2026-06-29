import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { startGrowthRunAction, syncPostizAccountsAction, importReferenceVideoAction } from "./actions";
import { checkFfmpegHealth } from "@/services/ffmpeg/health";
import { getPublishingProviderLabel } from "@/services/social-publishing";
import { GrowthLoop } from "@/components/growth-loop";
import { StartRunSubmit } from "./start-run-submit";
import { ProviderReadinessChip } from "@/components/growth/provider-readiness-chip";
import { NextMoveBanner } from "@/components/app/next-move-banner";
import { getNextMove } from "@/lib/next-move";
import { getProjectStats } from "../queries";
import { loadGrowthRunFormDefaults } from "@/lib/growth-run-defaults";

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
  const [runs, accounts, project, brief, stats, formDefaults] =
    await Promise.all([
    supabase
      .from("growth_runs")
      .select("id, status, phase, trigger, created_at, started_at, completed_at, error")
      .eq("project_id", projectId)
      .order("created_at", { ascending: false })
      .limit(20),
    supabase.from("connected_accounts").select("id, platform, handle, status").eq("project_id", projectId),
    supabase.from("projects").select("name, product_url").eq("id", projectId).single(),
    supabase.from("product_briefs").select("*").eq("project_id", projectId).maybeSingle(),
    getProjectStats(projectId),
    loadGrowthRunFormDefaults(projectId),
  ]);

  const activeRun = runs.data?.find((r) =>
    ["pending", "running", "awaiting_user_input", "awaiting_approval", "live"].includes(r.status)
  );

  const accountCount = accounts.data?.length ?? 0;
  const publishingLabel = getPublishingProviderLabel();
  const ffmpegHealth = checkFfmpegHealth();
  const hasProductUrl = Boolean(project.data?.product_url?.trim());
  const canStartRun = hasProductUrl;

  const nextMove = getNextMove({
    projectId,
    activeRunId: activeRun?.id ?? runs.data?.[0]?.id,
    stats,
  });
  const byPlatform = (accounts.data ?? []).reduce<Record<string, number>>((acc, a) => {
    acc[a.platform] = (acc[a.platform] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">Growth Runs</h1>
          <div className="flex flex-wrap items-center gap-2">
            <ProviderReadinessChip projectId={projectId} />
            <Link
              href={`/projects/${projectId}/growth/settings`}
              className="text-xs rounded-md border px-3 py-1.5 hover:bg-muted"
            >
              Growth settings
            </Link>
          </div>
        </div>
        <p className="text-sm text-muted-foreground max-w-2xl">
          Find the formats worth scaling for {project.data?.name ?? "this project"}, turn them into short-form video
          experiments, track what brings users, and compound the winners.
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
              No product URL saved. Create a new project from your product URL to start AutoScale.
            </span>
          )}
        </div>
      </header>

      <NextMoveBanner move={nextMove} />

      <GrowthLoop className="rounded-xl border bg-card/60 p-4" compact />

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">Connected accounts</h2>
            <p className="text-xs text-muted-foreground">
              {accountCount === 0
                ? `No accounts linked yet. Sync from ${publishingLabel} to enable multi-account posting.`
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
              Sync {publishingLabel} accounts
            </button>
          </form>
        </div>
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-3">
        <h2 className="text-sm font-semibold">Reference video URLs</h2>
        <p className="text-xs text-muted-foreground">
          Paste competitor or example short-form URLs as trend evidence for Winning Format Lab.
        </p>
        <form action={importReferenceVideoAction} className="flex flex-wrap gap-2 items-end">
          <input type="hidden" name="projectId" value={projectId} />
          <input
            name="url"
            type="url"
            required
            placeholder="https://www.tiktok.com/@..."
            className="flex-1 min-w-[200px] rounded-md border bg-background px-3 py-2 text-sm"
          />
          <select name="platform" className="rounded-md border bg-background px-2 py-2 text-sm">
            <option value="tiktok">TikTok</option>
            <option value="instagram">Instagram</option>
            <option value="youtube">YouTube</option>
          </select>
          <button type="submit" className="rounded-md border bg-background px-3 py-2 text-sm font-medium hover:bg-muted">
            Add reference
          </button>
        </form>
      </section>

      <section className="rounded-lg border bg-card p-4 space-y-4">
        <div>
          <h2 className="text-sm font-semibold">Start a Growth Run</h2>
          <p className="mt-1 text-xs text-muted-foreground">
            AutoScale runs end to end: brief, discovery, trend hops, video production, and scheduling.
          </p>
          {!ffmpegHealth.available ? (
            <p className="mt-2 text-xs text-amber-600 dark:text-amber-400">
              {ffmpegHealth.message} Video rendering may fail until FFmpeg is available.
            </p>
          ) : null}
        </div>

        <form action={startGrowthRunAction} className="grid gap-4 sm:grid-cols-2">
          <input type="hidden" name="projectId" value={projectId} />

          <div className="sm:col-span-2 rounded-lg border border-primary/25 bg-primary/[0.04] p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-primary">Product URL</p>
            <p className="mt-1 break-all font-mono text-sm">
              {project.data?.product_url ?? "Add a product URL in the Brief first"}
            </p>
          </div>

          <details className="sm:col-span-2 rounded-lg border bg-background/60 p-4">
            <summary className="cursor-pointer text-sm font-medium">Advanced Growth Run settings</summary>
            <p className="mt-2 text-xs text-muted-foreground">
              Defaults are tuned for a fast first run — expand to add platforms, formats, or duration.
            </p>
            <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <fieldset className="space-y-2 sm:col-span-2">
            <legend className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Target platforms
            </legend>
            <div className="flex flex-wrap gap-2">
              {(["tiktok", "instagram", "youtube"] as const).map((p) => (
                <label key={p} className="inline-flex items-center gap-2 rounded-md border px-3 py-1.5 text-xs">
                  <input
                    type="checkbox"
                    name="targetPlatforms"
                    value={p}
                    defaultChecked={formDefaults.targetPlatforms.includes(p)}
                  />
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
              defaultValue={formDefaults.approvalMode}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            >
              <option value="manual">Manual (review each video)</option>
              <option value="per_format">Per-format (auto-approve slide / founder / pain)</option>
              <option value="autopilot">Full autopilot (explicit opt-in)</option>
            </select>
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Posting aggressiveness
            </span>
            <select
              name="postingAggressiveness"
              defaultValue={formDefaults.postingAggressiveness}
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
              defaultValue={formDefaults.durationDays}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
          </label>

          <label className="space-y-1">
            <span className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Format hypotheses
            </span>
            <input
              type="number"
              name="formatHypothesisCount"
              min={1}
              max={2}
              defaultValue={formDefaults.formatHypothesisCount}
              className="w-full rounded-md border bg-background px-2 py-1.5 text-sm"
            />
            <span className="block text-[11px] text-muted-foreground">
              Each format gets exactly three controlled hook variants.
            </span>
          </label>

            </div>
          </details>

          <div className="sm:col-span-2">
            <StartRunSubmit disabled={!canStartRun} />
            <p className="mt-2 text-xs text-muted-foreground">
              Discovery and evidence gathering happen automatically inside the run.
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
