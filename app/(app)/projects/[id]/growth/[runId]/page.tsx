import { notFound } from "next/navigation";
import Link from "next/link";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import {
  recordMetricsAction,
  runCompoundAction,
  scheduleRunAction,
} from "../actions";
import { formatVideoTypeLabel } from "@/lib/growth-run/video-type-labels";
import { SchedulePreviewPanel } from "@/components/growth/schedule-preview-panel";
import { ProductionCommandCenter } from "@/components/growth/production-command-center";
import { loadProductionReview } from "@/lib/growth-run/load-production-review";
import {
  mapScheduleItemStatusToState,
  ScheduleStatusBadge,
  type PublishingProviderLabel,
} from "@/components/schedule-status-badge";
import { scheduleApprovedVideos } from "@/services/postiz/multi-account";
import { requireUser } from "@/lib/supabase/server";
import { loadProjectGrowthSettings } from "@/services/project-growth-settings/load";
import { resolveProjectCta } from "@/services/project-growth-settings/schema";
import { getManagedProviderConfig } from "@/services/providers/config";
import { getPublishingProviderLabel } from "@/services/social-publishing";
import { RunApprovalCard } from "@/components/growth/run-approval-card";
import { StageGateCard } from "@/components/growth/stage-gate-card";
import { RunRetryCard } from "@/components/growth/run-retry-card";
import { StageProgress, RunPageLiveUpdater } from "@/components/growth/run-phase-timeline";
import { RunPageAutoExecutor } from "@/components/growth/run-page-auto-executor";
import { RunningGrowthRunBanner, CancelGrowthRunButton } from "@/components/growth/cancel-growth-run-button";
import { RunEvidenceTabs } from "@/components/growth/run-evidence-tabs";
import { RunBriefPanel } from "@/components/growth/run-brief-panel";
import { isStageBoundaryPause, resolveRunStage, getStageById } from "@/lib/growth-run/stages";
import { GrowthRunOptionsSchema } from "@/services/growth-run/schema";
import { getProductionProviderStatus } from "@/lib/production-provider-status";

interface RunPageProps {
  params: { id: string; runId: string };
  searchParams?: { autoExecute?: string };
}

const PHASES = [
  "brief",
  "videotrend",
  "strategy",
  "loadout",
  "concepts",
  "scripts",
  "storyboards",
  "assets",
  "videos",
  "captions",
  "approval",
  "schedule",
  "live",
  "compound",
  "done",
] as const;

export default async function GrowthRunPage({ params, searchParams }: RunPageProps) {
  if (!isSupabaseConfigured()) return notFound();
  const supabase = createSupabaseServerClient();
  const projectId = params.id;
  const runId = params.runId;

  const { data: run } = await supabase
    .from("growth_runs")
    .select("*")
    .eq("id", runId)
    .eq("project_id", projectId)
    .maybeSingle();
  if (!run) notFound();

  const runOptionsRaw =
    run.options && typeof run.options === "object" && !Array.isArray(run.options)
      ? run.options
      : {};
  const storedRunOptions = GrowthRunOptionsSchema.partial().parse(runOptionsRaw);

  const publishingProviderLabel = getPublishingProviderLabel() as PublishingProviderLabel;

  const [
    trendReport,
    strategy,
    loadout,
    conceptsRes,
    videosRes,
    scheduleRes,
    resultsRes,
    fingerprintsRes,
    experimentsRes,
    receiptsRes,
    briefRes,
    sourcesRes,
    videoEvidenceRes,
    patternsRes,
    projectRes,
    productionReview,
  ] =
    await Promise.all([
      supabase.from("video_trend_reports").select("*").eq("growth_run_id", runId).maybeSingle(),
      supabase.from("video_strategies").select("*").eq("growth_run_id", runId).maybeSingle(),
      supabase.from("posting_loadouts").select("*").eq("growth_run_id", runId).maybeSingle(),
      supabase
        .from("video_concepts")
        .select("id, video_type, production_mode, platform, target_length_seconds, hook, angle, status, demo_clip_url")
        .eq("growth_run_id", runId)
        .order("video_type"),
      supabase
        .from("videos")
        .select(
          "id, concept_id, status, approval_status, duration_seconds, aspect_ratio, final_asset_id, created_at"
        )
        .eq("growth_run_id", runId)
        .order("created_at", { ascending: false }),
      supabase
        .from("schedule_items")
        .select("id, video_id, platform, status, scheduled_for, posted_url, postiz_post_id, failure_reason")
        .eq("growth_run_id", runId)
        .order("scheduled_for"),
      supabase
        .from("growth_experiment_results")
        .select("id, video_id, classification, diagnosis, next_action, confidence, created_at")
        .eq("growth_run_id", runId)
        .order("created_at", { ascending: false }),
      supabase
        .from("format_fingerprints")
        .select("id, name, video_type, platform, hook_mechanism, visual_grammar, script_structure, cta_pattern, business_hypothesis, transferability_score, distortion_risk, confidence, missing_evidence, evidence_video_ids, source_pattern_ids, status")
        .eq("growth_run_id", runId)
        .order("confidence", { ascending: false }),
      supabase
        .from("controlled_experiments")
        .select("id, format_fingerprint_id, tested_variable, audience_pain, fixed_body, fixed_cta, fixed_audience, evaluation_window_days, status, starts_at, ends_at")
        .eq("growth_run_id", runId),
      supabase
        .from("trend_receipts")
        .select("id, concept_id, format_fingerprint_id, evidence_video_ids, source_pattern_ids, observed_evidence, strategic_inference, expected_signal, reasoning, confidence, missing_evidence")
        .eq("growth_run_id", runId),
      supabase.from("product_briefs").select("product_name, one_line_description, product_summary, what_it_does, target_customer, primary_pain, core_promise, offer, cta, category, key_features, positioning_angles").eq("project_id", projectId).maybeSingle(),
      supabase.from("trendwatch_sources").select("id, source_url, platform, fetch_status, confidence_score").eq("project_id", projectId).order("created_at", { ascending: false }).limit(12),
      supabase.from("video_evidence").select("id, video_url, platform, title, source_confidence").eq("project_id", projectId).order("created_at", { ascending: false }).limit(12),
      supabase.from("video_patterns").select("id, pattern_type, label, confidence").eq("project_id", projectId).order("confidence", { ascending: false }).limit(12),
      supabase.from("projects").select("product_url, ai_model_slug").eq("id", projectId).maybeSingle(),
      loadProductionReview(supabase, projectId, runId),
    ]);

  const conceptIds = (conceptsRes.data ?? []).map((c) => c.id);
  const { data: scriptRows } = conceptIds.length
    ? await supabase
        .from("video_scripts")
        .select("concept_id, hook_line, voiceover_full")
        .in("concept_id", conceptIds)
    : { data: [] as Array<{ concept_id: string; hook_line: string | null; voiceover_full: string | null }> };
  const { data: storyboards } = conceptIds.length
    ? await supabase.from("storyboards").select("id, concept_id, total_duration_seconds").in("concept_id", conceptIds)
    : { data: [] as Array<{ id: string; concept_id: string; total_duration_seconds: number }> };

  const runProductionOptions = productionReview.productionContext.resolved;
  const workspaceVideos = productionReview.workspaceVideos;
  const workspaceSummary = productionReview.workspaceSummary;
  const conceptsById = new Map((conceptsRes.data ?? []).map((c) => [c.id, c]));

  const scheduleItemIds = (scheduleRes.data ?? []).map((s) => s.id);
  const { data: metricsSnapshotRows } = scheduleItemIds.length
    ? await supabase
        .from("metrics_snapshots")
        .select("schedule_item_id, source, fetched_at")
        .in("schedule_item_id", scheduleItemIds)
        .order("fetched_at", { ascending: false })
    : { data: [] as Array<{ schedule_item_id: string | null; source: string; fetched_at: string }> };

  const latestMetricsBySchedule = new Map<
    string,
    { source: string; fetchedAt: string }
  >();
  for (const row of metricsSnapshotRows ?? []) {
    if (!row.schedule_item_id || latestMetricsBySchedule.has(row.schedule_item_id)) continue;
    latestMetricsBySchedule.set(row.schedule_item_id, {
      source: row.source,
      fetchedAt: row.fetched_at,
    });
  }


  const videosWithConcept = (videosRes.data ?? []).map((v) => ({
    ...v,
    concept: v.concept_id ? conceptsById.get(v.concept_id) ?? null : null,
  }));
  const allApproved =
    videosWithConcept.length > 0 &&
    videosWithConcept.every(
      (v) => v.approval_status === "approved" || v.approval_status === "auto_approved"
    );

  const runStage = resolveRunStage({
    current_stage: run.current_stage,
    paused_at_phase: run.paused_at_phase,
    phase: run.phase,
    status: run.status,
  });

  const productionProviderStatus = getProductionProviderStatus();

  const stageGateSummary = {
    briefName: briefRes.data?.product_name,
    briefLine: briefRes.data?.one_line_description,
    sourceCount: sourcesRes.data?.length ?? 0,
    videoEvidenceCount: videoEvidenceRes.data?.length ?? 0,
    patternCount: patternsRes.data?.length ?? 0,
    trendStructures: Array.isArray(trendReport.data?.winning_structures)
      ? (trendReport.data!.winning_structures as unknown[]).length
      : undefined,
    trendConfidence: trendReport.data?.confidence,
    conceptCount: conceptsRes.data?.length ?? 0,
    scriptCount: scriptRows?.length ?? 0,
    storyboardCount: storyboards?.length ?? 0,
    scriptPreviews: (scriptRows ?? []).slice(0, 3).map((row) => {
      const concept = conceptsById.get(row.concept_id);
      const voiceover = (row.voiceover_full ?? "").trim();
      return {
        hook: row.hook_line || concept?.hook || "Script",
        excerpt: voiceover.slice(0, 160) || concept?.angle || "Script saved",
      };
    }),
    videoCount: productionReview.videoCount,
    approvedVideoCount: productionReview.approvedVideoCount,
  };

  const hasSilentVoiceover = productionReview.hasSilentVoiceover;

  let schedulePreview = null;
  const showScheduleStage =
    runStage === 4 || (run.phase === "schedule" && run.status === "awaiting_approval");
  if (showScheduleStage && allApproved) {
    const user = await requireUser();
    const settings = await loadProjectGrowthSettings(projectId);
    const { data: projectRow } = await supabase
      .from("projects")
      .select("product_url")
      .eq("id", projectId)
      .single();
    const cta = resolveProjectCta(settings, projectRow?.product_url ?? null);
    const baseAppUrl =
      process.env.AUTOSCALE_APP_URL ??
      process.env.NEXT_PUBLIC_APP_URL ??
      getManagedProviderConfig().appUrl ??
      "http://localhost:3000";
    schedulePreview = await scheduleApprovedVideos({
      growthRunId: runId,
      projectId,
      ownerId: user.id,
      baseAppUrl,
      destinationUrl: cta.url ?? projectRow?.product_url ?? baseAppUrl,
      intentType: cta.intentType,
      previewOnly: true,
    });
  }

  const runOptionsRecord =
    run.options && typeof run.options === "object" && !Array.isArray(run.options)
      ? (run.options as Record<string, unknown>)
      : {};
  const discoveryLowConfidence = runOptionsRecord.discovery_low_confidence === true;
  const videotrendLowConfidence =
    typeof trendReport.data?.confidence === "number" && trendReport.data.confidence < 0.35;
  const showLowConfidenceBanner = discoveryLowConfidence || videotrendLowConfidence;

  return (
    <div className="space-y-8 p-6">
      <header className="space-y-2">
        <div className="text-xs text-muted-foreground">
          <Link href={`/projects/${projectId}/growth`} className="underline">
            Growth Runs
          </Link>{" "}
          / {runId.slice(0, 8)}
        </div>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">
            Growth Run — {new Date(run.created_at).toLocaleString()}
          </h1>
          <CancelGrowthRunButton
            projectId={projectId}
            growthRunId={runId}
            runStatus={run.status}
          />
        </div>
        <p className="text-sm text-muted-foreground">
          status: <strong>{run.status}</strong> · phase: <strong>{run.phase}</strong> · trigger:{" "}
          {run.trigger}
          {run.execution_mode === "stage_only" && run.target_stage ? (
            <>
              {" "}
              ·{" "}
              <span className="rounded-full border border-violet-500/40 bg-violet-500/10 px-2 py-0.5 text-[11px] font-medium text-violet-800 dark:text-violet-200">
                Stage-only run · Stage {run.target_stage}
                {getStageById(run.target_stage)?.title
                  ? `: ${getStageById(run.target_stage)!.title}`
                  : ""}
              </span>
            </>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground">
          <a
            href={`/api/dev/verify-growth-run?project_id=${projectId}&growth_run_id=${runId}`}
            className="underline hover:text-foreground"
            target="_blank"
            rel="noreferrer"
          >
            Run engine verification
          </a>
        </p>
        {run.error ? (
          <pre className="rounded border bg-destructive/10 p-2 text-xs text-destructive whitespace-pre-wrap">
            {run.error}
          </pre>
        ) : null}
      </header>

      <RunPageAutoExecutor
        projectId={projectId}
        growthRunId={runId}
        initialStatus={run.status}
        autoExecute={searchParams?.autoExecute === "1"}
      />

      <RunningGrowthRunBanner
        projectId={projectId}
        growthRunId={runId}
        runStatus={run.status}
        phase={run.phase}
      />

      <RunPageLiveUpdater
        projectId={projectId}
        growthRunId={runId}
        runStatus={run.status}
      />

      {run.status === "awaiting_user_input" ? (
        isStageBoundaryPause(run.paused_at_phase) ? (
          <StageGateCard
            projectId={projectId}
            growthRunId={runId}
            pausedAtPhase={run.paused_at_phase}
            currentStage={run.current_stage}
            executionMode={run.execution_mode}
            targetStage={run.target_stage}
            summary={stageGateSummary}
            videoOutputMode={runProductionOptions.videoOutputMode}
            audioMode={runProductionOptions.audioMode}
            qualityTier={runProductionOptions.qualityTier}
            visualPipeline={
              storedRunOptions.visual_pipeline ?? "auto"
            }
            providerStatus={productionProviderStatus}
            canRerunStage3={run.paused_at_phase === "approval"}
          />
        ) : (
          <RunApprovalCard
            projectId={projectId}
            growthRunId={runId}
            pausedAtPhase={run.paused_at_phase}
          />
        )
      ) : null}

      {run.status === "failed" ? (
        <RunRetryCard
          projectId={projectId}
          growthRunId={runId}
          failedPhase={run.phase}
        />
      ) : null}

      <section className="grid gap-6 lg:grid-cols-[minmax(0,240px)_1fr]">
        <div className="rounded-xl border border-border bg-card p-4">
          <h2 className="text-sm font-semibold mb-3">Run progress</h2>
          <StageProgress
            currentPhase={run.phase}
            phaseStatus={(run.phase_status ?? {}) as Record<string, unknown>}
            runStatus={run.status}
            pausedAtPhase={run.paused_at_phase}
            currentStage={run.current_stage}
          />
        </div>
        <RunEvidenceTabs
          briefContent={
            briefRes.data ? (
              <RunBriefPanel
                brief={briefRes.data}
                modelSlug={projectRes.data?.ai_model_slug}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                Brief generates during the autobrief phase.
              </p>
            )
          }
          sourcesContent={
            <ul className="space-y-2 text-sm">
              {(sourcesRes.data ?? []).length === 0 ? (
                <li className="text-muted-foreground">Sources appear after discovery.</li>
              ) : (
                sourcesRes.data!.map((s) => (
                  <li key={s.id} className="rounded border p-2">
                    <p className="font-mono text-xs truncate">{s.source_url ?? s.platform}</p>
                    <p className="text-xs text-muted-foreground">{s.fetch_status} · conf {(s.confidence_score ?? 0).toFixed(2)}</p>
                  </li>
                ))
              )}
            </ul>
          }
          videosContent={
            <ul className="space-y-2 text-sm">
              {(videoEvidenceRes.data ?? []).length === 0 ? (
                <li className="text-muted-foreground">Video evidence appears after video discovery.</li>
              ) : (
                videoEvidenceRes.data!.map((v) => (
                  <li key={v.id} className="rounded border p-2">
                    <p className="font-medium truncate">{v.title ?? "Video"}</p>
                    <p className="text-xs text-muted-foreground">{v.platform}</p>
                  </li>
                ))
              )}
            </ul>
          }
          patternsContent={
            <ul className="space-y-2 text-sm">
              {(patternsRes.data ?? []).length === 0 ? (
                <li className="text-muted-foreground">Patterns appear after pattern mining.</li>
              ) : (
                patternsRes.data!.map((p) => (
                  <li key={p.id} className="rounded border p-2">
                    <p className="font-medium">{p.label}</p>
                    <p className="text-xs text-muted-foreground">{p.pattern_type} · {(p.confidence ?? 0).toFixed(2)}</p>
                  </li>
                ))
              )}
            </ul>
          }
        />
      </section>

      {showLowConfidenceBanner ? (
        <div
          role="status"
          className="rounded-lg border border-amber-500/40 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-100"
        >
          <p className="font-medium">Thin evidence — conservative run</p>
          <p className="mt-1 text-xs text-amber-800 dark:text-amber-200">
            {discoveryLowConfidence
              ? "Discovery found fewer than 3 video evidence items. "
              : ""}
            {videotrendLowConfidence
              ? `VideoTrend confidence is ${((trendReport.data?.confidence ?? 0) * 100).toFixed(0)}%. `
              : ""}
            Posting aggressiveness was capped and planned volume reduced. Add Sources or run Video
            Intelligence discovery for stronger patterns before the next run.
          </p>
        </div>
      ) : null}

      <PhaseStrip phase={run.phase} status={(run.phase_status ?? {}) as Record<string, unknown>} />

      {trendReport.data ? <TrendReportPanel report={trendReport.data} /> : null}
      {strategy.data ? <StrategyPanel strategy={strategy.data} loadout={loadout.data} /> : null}

      <WinningFormatLabPanel
        fingerprints={fingerprintsRes.data ?? []}
        experiments={experimentsRes.data ?? []}
        receipts={receiptsRes.data ?? []}
      />

      <ConceptsPanel concepts={conceptsRes.data ?? []} />

      {runStage >= 3 || workspaceVideos.length > 0 ? (
        <ProductionCommandCenter
          projectId={projectId}
          runId={runId}
          videos={workspaceVideos}
          videoOutputMode={runProductionOptions.videoOutputMode}
          creativeFormat={runProductionOptions.creativeFormat}
          qualityTier={runProductionOptions.qualityTier}
          audioMode={runProductionOptions.audioMode}
          visualPipeline={storedRunOptions.visual_pipeline ?? null}
          resolvedVisualPipeline={runProductionOptions.visualPipeline}
          providerStatus={productionProviderStatus}
          approvedCount={workspaceSummary.approved}
          readyCount={workspaceSummary.ready}
          totalCount={workspaceSummary.total}
          canRerunStage3={run.status !== "running"}
        />
      ) : null}

      {showScheduleStage && run.status === "awaiting_approval" ? (
        <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
            Stage 4 — Distribution
          </p>
          <p className="text-sm font-semibold">Scheduling and posting via Post Bridge</p>
          <p className="text-xs text-muted-foreground">
            Review the posting plan below, then schedule when ready.
          </p>
        </div>
      ) : null}

      {schedulePreview ? (
        <SchedulePreviewPanel
          preview={schedulePreview}
          projectId={projectId}
          growthRunId={runId}
          scheduleAction={scheduleRunAction}
          providerLabel={publishingProviderLabel}
          hasSilentVoiceover={hasSilentVoiceover}
        />
      ) : showScheduleStage && allApproved ? (
        <form action={scheduleRunAction} className="rounded-lg border bg-card p-4 text-sm space-y-3">
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <p>
            All videos approved. Push to {publishingProviderLabel} across connected accounts:
          </p>
          {hasSilentVoiceover ? (
            <label className="flex items-center gap-2 text-xs text-amber-700 dark:text-amber-300">
              <input type="checkbox" name="confirmSilentOverride" />
              Schedule silent voiceover anyway
            </label>
          ) : null}
          <button
            type="submit"
            className="rounded-md bg-foreground px-4 py-2 text-sm font-medium text-background hover:opacity-90"
          >
            Schedule via {publishingProviderLabel}
          </button>
        </form>
      ) : null}

      {videosWithConcept.length > 0 ? (
        <section className="rounded-lg border bg-card p-4 text-sm">
          <p className="mb-3 text-muted-foreground">
            {publishingProviderLabel} unavailable or you prefer manual posting? Download schedule CSV, captions, and
            media URLs.
          </p>
          <a
            href={`/api/projects/${projectId}/growth/${runId}/export`}
            className="inline-flex rounded-md border bg-background px-4 py-2 text-sm font-medium hover:bg-muted"
          >
            Download export pack (ZIP)
          </a>
        </section>
      ) : null}

      <SchedulePanel
        projectId={projectId}
        runId={runId}
        items={scheduleRes.data ?? []}
        latestMetricsBySchedule={latestMetricsBySchedule}
        providerLabel={publishingProviderLabel}
      />

      <CompoundPanel
        projectId={projectId}
        runId={runId}
        results={resultsRes.data ?? []}
      />
    </div>
  );
}

function PhaseStrip({
  phase,
  status,
}: {
  phase: string;
  status: Record<string, unknown>;
}) {
  return (
    <div className="overflow-x-auto rounded-lg border bg-card p-3 text-xs">
      <div className="flex items-center gap-1">
        {PHASES.map((p) => {
          const s = (status[p] as { status?: string } | undefined)?.status;
          const isCurrent = p === phase;
          const tone =
            s === "succeeded"
              ? "bg-green-500/15 text-green-700 dark:text-green-300"
              : s === "running" || isCurrent
                ? "bg-blue-500/15 text-blue-700 dark:text-blue-300"
                : s === "failed"
                  ? "bg-red-500/15 text-red-700 dark:text-red-300"
                  : "bg-muted text-muted-foreground";
          return (
            <span key={p} className={`rounded px-2 py-1 ${tone}`}>
              {p}
            </span>
          );
        })}
      </div>
    </div>
  );
}

function TrendReportPanel({ report }: { report: { winning_structures: unknown; hook_patterns: unknown; recommended_experiments: unknown; competitor_gaps: unknown; confidence: number } }) {
  const structures = (report.winning_structures as Array<{ name: string; ideal_length_seconds: number; why_it_works: string }>) ?? [];
  const hooks = (report.hook_patterns as Array<{ label: string; pattern: string }>) ?? [];
  const experiments = (report.recommended_experiments as Array<{ hypothesis: string; video_type: string; platform: string }>) ?? [];
  const gaps = (report.competitor_gaps as string[]) ?? [];

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <header className="flex items-baseline justify-between">
        <h2 className="text-sm font-semibold">VideoTrend report</h2>
        <span className="text-xs text-muted-foreground">
          confidence {(report.confidence * 100).toFixed(0)}%
        </span>
      </header>
      <div className="grid gap-3 sm:grid-cols-2">
        <Block title="Winning structures">
          <ul className="space-y-1 text-xs">
            {structures.slice(0, 4).map((s, i) => (
              <li key={i}>
                <strong>{s.name}</strong> — {s.ideal_length_seconds}s — {s.why_it_works}
              </li>
            ))}
          </ul>
        </Block>
        <Block title="Hook patterns">
          <ul className="space-y-1 text-xs">
            {hooks.slice(0, 6).map((h, i) => (
              <li key={i}>
                <strong>{h.label}:</strong> {h.pattern}
              </li>
            ))}
          </ul>
        </Block>
        <Block title="Recommended experiments">
          <ul className="space-y-1 text-xs">
            {experiments.slice(0, 6).map((e, i) => (
              <li key={i}>
                [{e.platform} • {e.video_type}] {e.hypothesis}
              </li>
            ))}
          </ul>
        </Block>
        <Block title="Competitor gaps">
          <ul className="list-disc pl-5 text-xs space-y-1">
            {gaps.slice(0, 6).map((g, i) => (
              <li key={i}>{g}</li>
            ))}
          </ul>
        </Block>
      </div>
    </section>
  );
}

function StrategyPanel({ strategy, loadout }: { strategy: { platform_mix: unknown; video_type_mix: unknown; campaign_hypotheses: unknown; rationale: string | null }; loadout: { per_account_plan: unknown; total_videos_planned: number; duration_days: number } | null }) {
  const platforms = (strategy.platform_mix as Record<string, number>) ?? {};
  const types = (strategy.video_type_mix as Record<string, number>) ?? {};
  const hyps = (strategy.campaign_hypotheses as Array<{ hypothesis: string; metric_to_watch: string }>) ?? [];
  const accounts = (loadout?.per_account_plan as Array<{ platform: string; handle: string; videos_per_day: number }>) ?? [];

  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Strategy + loadout</h2>
      <div className="grid gap-3 sm:grid-cols-3 text-xs">
        <Block title="Platform mix">
          {Object.entries(platforms).map(([k, v]) => (
            <div key={k}>{k}: {(Number(v) * 100).toFixed(0)}%</div>
          ))}
        </Block>
        <Block title="Video type mix">
          {Object.entries(types).map(([k, v]) => (
            <div key={k}>{k}: {(Number(v) * 100).toFixed(0)}%</div>
          ))}
        </Block>
        <Block title={loadout ? `Loadout (${loadout.total_videos_planned} videos / ${loadout.duration_days}d)` : "Loadout"}>
          {accounts.length === 0 ? <span className="text-muted-foreground">No connected accounts.</span> : accounts.map((a, i) => (
            <div key={i}>{a.platform}/{a.handle}: {a.videos_per_day}/day</div>
          ))}
        </Block>
      </div>
      {strategy.rationale ? (
        <p className="text-xs text-muted-foreground border-t pt-2">{strategy.rationale}</p>
      ) : null}
      {hyps.length ? (
        <Block title="Campaign hypotheses">
          <ul className="space-y-1 text-xs">
            {hyps.map((h, i) => (
              <li key={i}>
                <strong>If:</strong> {h.hypothesis} — <em>watch:</em> {h.metric_to_watch}
              </li>
            ))}
          </ul>
        </Block>
      ) : null}
    </section>
  );
}

function ConceptsPanel({ concepts }: { concepts: Array<{ id: string; video_type: string; platform: string; target_length_seconds: number; hook: string; angle: string | null; status: string }> }) {
  if (!concepts.length) return null;
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Concepts ({concepts.length})</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="text-left text-muted-foreground">
            <tr>
              <th className="px-2 py-1">Type</th>
              <th className="px-2 py-1">Platform</th>
              <th className="px-2 py-1">Length</th>
              <th className="px-2 py-1">Hook</th>
              <th className="px-2 py-1">Status</th>
            </tr>
          </thead>
          <tbody>
            {concepts.map((c) => (
              <tr key={c.id} className="border-t">
                <td className="px-2 py-1">{formatVideoTypeLabel(c.video_type)}</td>
                <td className="px-2 py-1">{c.platform}</td>
                <td className="px-2 py-1">{c.target_length_seconds}s</td>
                <td className="px-2 py-1">{c.hook}</td>
                <td className="px-2 py-1">{c.status}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function WinningFormatLabPanel({
  fingerprints,
  experiments,
  receipts,
}: {
  fingerprints: Array<{
    id: string;
    name: string;
    video_type: string;
    platform: string;
    hook_mechanism: string;
    visual_grammar: string;
    script_structure: unknown;
    cta_pattern: string;
    business_hypothesis: string;
    transferability_score: number;
    distortion_risk: string;
    confidence: number;
    missing_evidence: unknown;
    evidence_video_ids: unknown;
    source_pattern_ids: unknown;
    status: string;
  }>;
  experiments: Array<{
    id: string;
    format_fingerprint_id: string;
    tested_variable: string;
    audience_pain: string;
    fixed_body: string;
    fixed_cta: string;
    fixed_audience: string;
    evaluation_window_days: number;
    status: string;
    starts_at: string | null;
    ends_at: string | null;
  }>;
  receipts: Array<{
    id: string;
    concept_id: string;
    format_fingerprint_id: string;
    evidence_video_ids: unknown;
    source_pattern_ids: unknown;
    observed_evidence: unknown;
    strategic_inference: unknown;
    expected_signal: string;
    reasoning: string;
    confidence: number;
    missing_evidence: unknown;
  }>;
}) {
  if (!fingerprints.length) return null;
  const experimentByFormat = new Map(experiments.map((experiment) => [experiment.format_fingerprint_id, experiment]));

  return (
    <section className="rounded-lg border border-primary/30 bg-primary/[0.03] p-4 space-y-4">
      <header className="space-y-1">
        <div className="text-[10px] font-semibold uppercase tracking-[0.2em] text-primary">Winning Format Lab</div>
        <h2 className="text-base font-semibold">Controlled format experiments</h2>
        <p className="max-w-3xl text-xs text-muted-foreground">
          Each format holds the audience, body, CTA, platform, and production grammar constant. Only the named variable changes.
        </p>
      </header>

      <div className="grid gap-4 lg:grid-cols-2">
        {fingerprints.map((fingerprint) => {
          const experiment = experimentByFormat.get(fingerprint.id);
          const formatReceipts = receipts.filter((receipt) => receipt.format_fingerprint_id === fingerprint.id);
          const representativeReceipt = formatReceipts[0];
          const missing = asTextArray(fingerprint.missing_evidence);
          return (
            <article key={fingerprint.id} className="rounded-lg border bg-card p-4 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h3 className="text-sm font-semibold">{fingerprint.name}</h3>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {fingerprint.platform} · {formatVideoTypeLabel(fingerprint.video_type)} · testing {experiment?.tested_variable ?? "unknown"}
                  </p>
                </div>
                <span className="rounded-full border border-primary/30 bg-primary/10 px-2 py-1 text-[10px] font-semibold text-primary">
                  {fingerprint.status}
                </span>
              </div>

              <div className="grid grid-cols-3 gap-2 text-xs">
                <LabMetric label="Confidence" value={`${Math.round(fingerprint.confidence * 100)}%`} />
                <LabMetric label="Transferable" value={`${Math.round(fingerprint.transferability_score * 100)}%`} />
                <LabMetric label="Evidence" value={String(countItems(fingerprint.evidence_video_ids) + countItems(fingerprint.source_pattern_ids))} />
              </div>

              <dl className="space-y-2 text-xs">
                <LabRow label="Hook mechanism" value={fingerprint.hook_mechanism} />
                <LabRow label="Visual grammar" value={fingerprint.visual_grammar} />
                <LabRow label="Script" value={asTextArray(fingerprint.script_structure).join(" → ") || "Not enough evidence"} />
                <LabRow label="CTA pattern" value={fingerprint.cta_pattern} />
                <LabRow label="Business hypothesis" value={fingerprint.business_hypothesis} />
                <LabRow label="Distortion risk" value={fingerprint.distortion_risk} />
                {experiment ? <LabRow label="Evaluation window" value={`${experiment.evaluation_window_days} days · ${experiment.status}`} /> : null}
              </dl>

              {representativeReceipt ? (
                <div className="rounded-md border bg-background p-3 text-xs space-y-2">
                  <div className="font-semibold">Trend Receipt · {formatReceipts.length} controlled variants</div>
                  <div><span className="text-muted-foreground">Observed:</span> {asTextArray(representativeReceipt.observed_evidence).join("; ")}</div>
                  <div><span className="text-muted-foreground">Inference:</span> {asTextArray(representativeReceipt.strategic_inference).join("; ")}</div>
                  <div><span className="text-muted-foreground">Expected signal:</span> {representativeReceipt.expected_signal}</div>
                </div>
              ) : null}

              {missing.length ? (
                <p className="rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-700 dark:text-amber-300">
                  Missing evidence: {missing.join("; ")}
                </p>
              ) : null}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function LabMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background p-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-1 font-semibold">{value}</div>
    </div>
  );
}

function LabRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="grid grid-cols-[7rem_1fr] gap-2">
      <dt className="text-muted-foreground">{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

function asTextArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];
}

function countItems(value: unknown): number {
  return Array.isArray(value) ? value.length : 0;
}

function formatRelativeTime(iso: string): string {
  const deltaMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.round(deltaMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return `${days}d ago`;
}

function MetricsSyncBadge({
  metrics,
}: {
  metrics?: { source: string; fetchedAt: string };
}) {
  if (!metrics) return null;
  const label =
    metrics.source === "postbridge"
      ? "Auto-synced via Post Bridge"
      : metrics.source === "manual"
        ? "Manual entry"
        : `Synced (${metrics.source})`;
  return (
    <div className="flex flex-wrap items-center gap-2 text-[10px] text-muted-foreground">
      <span className="rounded-full border px-2 py-0.5">{label}</span>
      <span>Last synced: {formatRelativeTime(metrics.fetchedAt)}</span>
    </div>
  );
}

function SchedulePanel({
  projectId,
  runId,
  items,
  latestMetricsBySchedule,
  providerLabel,
}: {
  projectId: string;
  runId: string;
  items: Array<{ id: string; video_id: string; platform: string; status: string; scheduled_for: string; posted_url: string | null; postiz_post_id: string | null; failure_reason: string | null }>;
  latestMetricsBySchedule: Map<string, { source: string; fetchedAt: string }>;
  providerLabel: PublishingProviderLabel;
}) {
  if (!items.length) return null;
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <h2 className="text-sm font-semibold">Schedule ({items.length})</h2>
      <ul className="divide-y text-xs">
        {items.map((it) => (
          <li key={it.id} className="py-3 space-y-2">
            <div className="flex justify-between gap-4">
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-medium">{it.platform}</span>
                  <ScheduleStatusBadge
                    state={mapScheduleItemStatusToState(it.status)}
                    providerLabel={providerLabel}
                    detail={
                      it.status === "failed" && it.failure_reason
                        ? it.failure_reason
                        : it.posted_url
                          ? "live"
                          : null
                    }
                  />
                </div>
                <div className="text-muted-foreground">
                  scheduled {new Date(it.scheduled_for).toLocaleString()}
                  {it.posted_url ? ` · live: ${it.posted_url}` : null}
                  {it.postiz_post_id ? ` · remote:${it.postiz_post_id}` : null}
                </div>
                {it.failure_reason && it.status === "failed" ? (
                  <div className="text-red-600 dark:text-red-300">{it.failure_reason}</div>
                ) : null}
                <MetricsSyncBadge metrics={latestMetricsBySchedule.get(it.id)} />
              </div>
            </div>
            <form
              action={recordMetricsAction}
              className="grid grid-cols-2 sm:grid-cols-4 gap-2 text-xs"
            >
              <input type="hidden" name="projectId" value={projectId} />
              <input type="hidden" name="growthRunId" value={runId} />
              <input type="hidden" name="scheduleItemId" value={it.id} />
              <input type="hidden" name="videoId" value={it.video_id} />
              {(["views", "likes", "comments", "shares", "saves", "linkClicks", "signups"] as const).map(
                (k) => (
                  <input
                    key={k}
                    type="number"
                    name={k}
                    min={0}
                    placeholder={k}
                    className="rounded border bg-background px-2 py-1"
                  />
                )
              )}
              <input
                type="number"
                step="0.01"
                min={0}
                max={1}
                name="completionRate"
                placeholder="completion 0..1"
                className="rounded border bg-background px-2 py-1"
              />
              <button type="submit" className="rounded border px-2 py-1 hover:bg-muted">
                Record metrics
              </button>
            </form>
          </li>
        ))}
      </ul>
    </section>
  );
}

function CompoundPanel({
  projectId,
  runId,
  results,
}: {
  projectId: string;
  runId: string;
  results: Array<{ id: string; video_id: string; classification: string; diagnosis: string | null; next_action: string; confidence: number; created_at: string }>;
}) {
  return (
    <section className="rounded-lg border bg-card p-4 space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Compound</h2>
        <form action={runCompoundAction}>
          <input type="hidden" name="projectId" value={projectId} />
          <input type="hidden" name="growthRunId" value={runId} />
          <button
            type="submit"
            className="rounded-md border bg-background px-3 py-1.5 text-xs font-medium hover:bg-muted"
          >
            Run Compound now
          </button>
        </form>
      </header>
      {results.length === 0 ? (
        <p className="text-xs text-muted-foreground">
          No experiment results yet. Record metrics on schedule items and then run Compound.
        </p>
      ) : (
        <ul className="divide-y text-xs">
          {results.map((r) => (
            <li key={r.id} className="py-2">
              <div className="font-medium">
                {r.classification} → {r.next_action}{" "}
                <span className="text-muted-foreground">
                  ({(r.confidence * 100).toFixed(0)}%)
                </span>
              </div>
              <div className="text-muted-foreground">{r.diagnosis}</div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="rounded-md border bg-background p-3 space-y-1">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{title}</div>
      {children}
    </div>
  );
}
