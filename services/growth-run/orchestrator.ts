import "server-only";

import { createSupabaseServerClient, createSupabaseAdminClient } from "@/lib/supabase/server";
import {
  GrowthRunOptionsSchema,
  type GrowthRunOptions,
} from "./schema";
import {
  createGrowthRun,
  markPhaseStatus,
  setPhase,
} from "./repository";
import { runDiscoveryPhase } from "./run-discovery-phase";
import { generateVideoTrendReport } from "@/services/videotrend/generate";
import { generateVideoStrategy } from "@/services/video-strategy/generate";
import { generateVideoConcepts } from "@/services/video-factory/concepts";
import { buildScriptsAndStoryboardsForRun, renderVideosForRun } from "@/services/video-factory";
import { runAutobriefPhase } from "./run-autobrief-phase";
import { runTrendhopPhase } from "./run-trendhop-phase";
import {
  maybePauseForUserApproval,
  RunPausedForApprovalError,
} from "./approval-gates";
import { maybePauseAtStageBoundary } from "./stage-gates";
import type { ApprovalGatePhase } from "@/lib/approval-policy";
import {
  getStageByBoundaryPhase,
  getStageForPhase,
  type GrowthRunStageId,
} from "@/lib/growth-run/stages";
import {
  getResumePhaseBeforeStage,
  loadConceptIdsForStage3,
  projectHasRepeatRunEligibility,
  validateStagePreconditions,
} from "@/lib/growth-run/stage-preconditions";
import { getUserApprovalPolicy } from "@/lib/user-approval-settings";
import { withProjectAIContext, getProjectAIModelSlug } from "@/services/ai/runtime";

export type GrowthRunExecutionMode = "sequential_first" | "stage_only";

export const UNIFIED_RUN_PHASES = [
  "autobrief",
  "deep_discovery",
  "video_discovery",
  "pattern_mining",
  "trendhop",
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
] as const;

export type UnifiedRunPhase = (typeof UNIFIED_RUN_PHASES)[number];

export interface StartGrowthRunInput {
  projectId: string;
  ownerId: string;
  options?: Partial<GrowthRunOptions>;
  trigger?: "manual" | "autopilot" | "scheduled";
  trustedServiceRole?: boolean;
  existingRunId?: string;
  /** When true, run autobrief from product_url before discovery. */
  unified?: boolean;
  productUrl?: string;
  crawlId?: string | null;
  profile?: "signup" | "project";
  /** Resume from phase after this gate (user approved). */
  resumeAfterPhase?: string | null;
  executionMode?: GrowthRunExecutionMode;
  targetStage?: GrowthRunStageId;
}

export interface StartGrowthRunResult {
  growthRunId: string;
  status: string;
  videoIds: string[];
  failures: Array<{ conceptId: string; error: string }>;
  pausedAtPhase?: string;
}

export class GrowthRunExecutionError extends Error {
  constructor(
    public readonly growthRunId: string,
    message: string,
    options?: ErrorOptions
  ) {
    super(message, options);
    this.name = "GrowthRunExecutionError";
  }
}

function phaseIndex(phase: string): number {
  const idx = UNIFIED_RUN_PHASES.indexOf(phase as UnifiedRunPhase);
  return idx === -1 ? 0 : idx;
}

function isPhaseInExecutionScope(
  phase: UnifiedRunPhase,
  ctx: { executionMode: GrowthRunExecutionMode; targetStage?: GrowthRunStageId }
): boolean {
  if (ctx.executionMode !== "stage_only" || !ctx.targetStage) return true;
  const stage = getStageForPhase(phase);
  return stage?.id === ctx.targetStage;
}

function shouldRunPhase(
  phase: UnifiedRunPhase,
  resumeAfterPhase: string | null,
  ctx: { executionMode: GrowthRunExecutionMode; targetStage?: GrowthRunStageId }
): boolean {
  if (!isPhaseInExecutionScope(phase, ctx)) return false;
  if (!resumeAfterPhase) return true;
  return phaseIndex(phase) > phaseIndex(resumeAfterPhase);
}

function previousUnifiedPhase(phase: string): string | null {
  const idx = phaseIndex(phase);
  if (idx <= 0) return null;
  return UNIFIED_RUN_PHASES[idx - 1] ?? null;
}

function mapStrategyRow(row: {
  platform_mix: unknown;
  video_type_mix: unknown;
  campaign_hypotheses: unknown;
  rationale: string | null;
}) {
  return {
    platform_mix: row.platform_mix as never,
    video_type_mix: row.video_type_mix as never,
    campaign_hypotheses: row.campaign_hypotheses as never,
    rationale: row.rationale ?? "",
  };
}

function mapLoadoutRow(row: {
  per_account_plan: unknown;
  total_videos_planned: number;
  duration_days: number;
}) {
  return {
    per_account_plan: row.per_account_plan as never,
    total_videos_planned: row.total_videos_planned,
    duration_days: row.duration_days,
  };
}

function mapTrendReportRow(row: {
  confidence: number;
  winning_structures: unknown;
  hook_patterns: unknown;
  opening_frames: unknown;
  cta_patterns: unknown;
  audience_language: unknown;
  platform_patterns: unknown;
  recommended_experiments: unknown;
  competitor_gaps: unknown;
  repurposable_formats: unknown;
  evidence_video_ids: unknown;
}) {
  return {
    confidence: row.confidence,
    winning_structures: row.winning_structures as never,
    hook_patterns: row.hook_patterns as never,
    opening_frames: row.opening_frames as never,
    cta_patterns: row.cta_patterns as never,
    audience_language: row.audience_language as never,
    platform_patterns: row.platform_patterns as never,
    recommended_experiments: row.recommended_experiments as never,
    competitor_gaps: row.competitor_gaps as never,
    repurposable_formats: row.repurposable_formats as never,
    evidence_video_ids: row.evidence_video_ids as never,
  } as Awaited<ReturnType<typeof generateVideoTrendReport>>["report"];
}

async function loadTrendReportForRun(
  supabase: ReturnType<typeof createSupabaseServerClient>,
  runIds: string[]
) {
  for (const runId of runIds) {
    const { data: existingReport } = await supabase
      .from("video_trend_reports")
      .select("*")
      .eq("growth_run_id", runId)
      .maybeSingle();
    if (existingReport) return mapTrendReportRow(existingReport);
  }
  return null;
}

async function gate(
  input: {
    client: ReturnType<typeof createSupabaseServerClient>;
    growthRunId: string;
    ownerId: string;
    phase: ApprovalGatePhase;
    policy: Awaited<ReturnType<typeof getUserApprovalPolicy>>;
  }
) {
  await maybePauseForUserApproval(input);
}

export async function startGrowthRun(
  input: StartGrowthRunInput
): Promise<StartGrowthRunResult> {
  const options = GrowthRunOptionsSchema.parse(input.options ?? {});
  const supabase = input.trustedServiceRole
    ? createSupabaseAdminClient()
    : createSupabaseServerClient();

  const projectModel = await getProjectAIModelSlug(input.projectId);
  const approvalPolicy = await getUserApprovalPolicy(input.ownerId);

  const run = input.existingRunId
    ? { id: input.existingRunId }
    : await createGrowthRun({
        projectId: input.projectId,
        options: {
          ...options,
          unified: input.unified ?? false,
          product_url: input.productUrl,
          crawl_id: input.crawlId,
        } as Record<string, unknown>,
        trigger: input.trigger ?? "manual",
        approvalMode: options.approval_mode,
        postingAggressiveness: options.posting_aggressiveness,
        targetPlatforms: options.target_platforms,
        brandConstraints: options.brand_constraints,
        distributionMode: options.distribution_mode,
        executionMode: input.executionMode,
        targetStage: input.targetStage,
        client: supabase,
      });

  const runId = run.id;
  const resumeAfter = input.resumeAfterPhase ?? null;

  if (input.existingRunId || input.resumeAfterPhase) {
    const nextStage =
      input.targetStage ??
      (input.resumeAfterPhase
        ? (() => {
            const completed = getStageByBoundaryPhase(input.resumeAfterPhase!);
            return completed ? Math.min(completed.id + 1, 4) : 1;
          })()
        : 1);

    await supabase
      .from("growth_runs")
      .update({
        status: "running",
        paused_at_phase: null,
        error: null,
        started_at: new Date().toISOString(),
        current_stage: nextStage,
        ...(input.executionMode ? { execution_mode: input.executionMode } : {}),
        ...(input.targetStage ? { target_stage: input.targetStage } : {}),
      })
      .eq("id", runId);
  } else if (input.executionMode === "stage_only" && input.targetStage) {
    await supabase
      .from("growth_runs")
      .update({
        execution_mode: "stage_only",
        target_stage: input.targetStage,
        current_stage: input.targetStage,
      })
      .eq("id", runId);
  }

  const runOptions = options;
  let videoIds: string[] = [];
  let failures: Array<{ conceptId: string; error: string }> = [];
  let discovery = {
    lowConfidence: false,
    evidenceCount: 0,
    patternsMined: 0,
  };

  return withProjectAIContext(projectModel, async () => {
    try {
      const { data: runRow } = await supabase
        .from("growth_runs")
        .select("options, execution_mode, target_stage, parent_run_id")
        .eq("id", runId)
        .single();
      const storedOpts = (runRow?.options ?? {}) as Record<string, unknown>;
      const execCtx = {
        executionMode: (input.executionMode ??
          runRow?.execution_mode ??
          "sequential_first") as GrowthRunExecutionMode,
        targetStage: (input.targetStage ??
          runRow?.target_stage ??
          undefined) as GrowthRunStageId | undefined,
      };
      const parentRunId = runRow?.parent_run_id ?? null;
      const artifactRunIds = [runId, parentRunId].filter(Boolean) as string[];
      const unified = input.unified ?? storedOpts.unified === true;
      const productUrl =
        input.productUrl ??
        (typeof storedOpts.product_url === "string" ? storedOpts.product_url : null);
      const crawlId =
        input.crawlId ??
        (typeof storedOpts.crawl_id === "string" ? storedOpts.crawl_id : null);

      // --- autobrief ---
      if (unified && productUrl && shouldRunPhase("autobrief", resumeAfter, execCtx)) {
        await setPhase(supabase, runId, "autobrief");
        await markPhaseStatus(supabase, runId, "autobrief", "running");
        const briefResult = await runAutobriefPhase({
          projectId: input.projectId,
          ownerId: input.ownerId,
          productUrl,
          crawlId,
          profile: input.profile ?? "project",
          client: supabase,
        });
        await markPhaseStatus(supabase, runId, "autobrief", "succeeded", {
          lowConfidence: briefResult.lowConfidence,
          productName: briefResult.productName,
        });
        await gate({
          client: supabase,
          growthRunId: runId,
          ownerId: input.ownerId,
          phase: "autobrief",
          policy: approvalPolicy,
        });
      } else if (!unified) {
        await setPhase(supabase, runId, "brief");
        await markPhaseStatus(supabase, runId, "brief", "succeeded");
      }

      // --- discovery sub-phases ---
      if (shouldRunPhase("deep_discovery", resumeAfter, execCtx)) {
        discovery = await runDiscoveryPhase({
          projectId: input.projectId,
          growthRunId: runId,
          client: supabase,
          onSubPhase: async (phase, status, details) => {
            await setPhase(supabase, runId, phase);
            await markPhaseStatus(supabase, runId, phase, status, details);
            if (status === "succeeded") {
              const gatePhase = phase as ApprovalGatePhase;
              if (
                gatePhase === "deep_discovery" ||
                gatePhase === "video_discovery" ||
                gatePhase === "pattern_mining"
              ) {
                await gate({
                  client: supabase,
                  growthRunId: runId,
                  ownerId: input.ownerId,
                  phase: gatePhase,
                  policy: approvalPolicy,
                });
              }
            }
          },
        });
      }

      // --- trendhop ---
      if (shouldRunPhase("trendhop", resumeAfter, execCtx)) {
        await setPhase(supabase, runId, "trendhop");
        await markPhaseStatus(supabase, runId, "trendhop", "running");
        const hop = await runTrendhopPhase({
          projectId: input.projectId,
          growthRunId: runId,
          ownerId: input.ownerId,
          client: supabase,
        });
        await markPhaseStatus(supabase, runId, "trendhop", "succeeded", {
          itemCount: hop.itemCount,
          conceptsQueued: hop.conceptsQueued,
        });
        await gate({
          client: supabase,
          growthRunId: runId,
          ownerId: input.ownerId,
          phase: "trendhop",
          policy: approvalPolicy,
        });
      }

      let report: Awaited<ReturnType<typeof generateVideoTrendReport>>["report"] | null = null;
      let strategy: Awaited<ReturnType<typeof generateVideoStrategy>>["strategy"] | null = null;
      let loadout: Awaited<ReturnType<typeof generateVideoStrategy>>["loadout"] | null = null;

      if (!shouldRunPhase("videotrend", resumeAfter, execCtx)) {
        report = await loadTrendReportForRun(supabase, artifactRunIds);
        const { data: existingStrategy } = await supabase
          .from("video_strategies")
          .select("*")
          .eq("growth_run_id", runId)
          .maybeSingle();
        const { data: existingLoadout } = await supabase
          .from("posting_loadouts")
          .select("*")
          .eq("growth_run_id", runId)
          .maybeSingle();
        if (existingStrategy) {
          strategy = mapStrategyRow(existingStrategy);
        }
        if (existingLoadout) {
          loadout = mapLoadoutRow(existingLoadout);
        }
      }

      // --- videotrend ---
      let justCompletedStage1 = false;
      if (shouldRunPhase("videotrend", resumeAfter, execCtx)) {
        if (discovery.evidenceCount === 0 && discovery.patternsMined === 0) {
          throw new Error(
            "Discovery did not produce video evidence or patterns. Add competitor sources on the Library page or retry the run after discovery completes."
          );
        }
        await setPhase(supabase, runId, "videotrend");
        await markPhaseStatus(supabase, runId, "videotrend", "running");
        const vt = await generateVideoTrendReport({
          projectId: input.projectId,
          growthRunId: runId,
          ownerId: input.ownerId,
          lowConfidenceEvidence: discovery.lowConfidence,
          evidenceCount: discovery.evidenceCount,
        });
        report = vt.report;
        await markPhaseStatus(supabase, runId, "videotrend", "succeeded", {
          confidence: report.confidence,
          structures: report.winning_structures.length,
          lowConfidence: discovery.lowConfidence || report.confidence < 0.35,
          evidenceCount: discovery.evidenceCount,
          hookValidation: vt.hookValidation,
        });
        justCompletedStage1 = true;
      }

      if (justCompletedStage1) {
        await maybePauseAtStageBoundary({
          client: supabase,
          growthRunId: runId,
          stage: 1,
          boundaryPhase: "videotrend",
        });
      }

      if (
        execCtx.executionMode === "stage_only" &&
        execCtx.targetStage === 2 &&
        !report
      ) {
        throw new Error(
          "Video trend report missing. Run Stage 1 (Research) before strategy & scripts."
        );
      }

      const thinEvidence =
        discovery.lowConfidence || (report?.confidence ?? 1) < 0.35;
      const strategyOptions =
        thinEvidence && runOptions.posting_aggressiveness !== "conservative"
          ? { ...runOptions, posting_aggressiveness: "conservative" as const }
          : runOptions;

      // --- strategy + loadout ---
      if (shouldRunPhase("strategy", resumeAfter, execCtx) && report) {
        await setPhase(supabase, runId, "strategy");
        await markPhaseStatus(supabase, runId, "strategy", "running");
        const st = await generateVideoStrategy({
          projectId: input.projectId,
          growthRunId: runId,
          ownerId: input.ownerId,
          trendReport: report,
          options: strategyOptions,
          lowConfidenceEvidence: discovery.lowConfidence,
          evidenceCount: discovery.evidenceCount,
          patternCount: discovery.patternsMined,
        });
        strategy = st.strategy;
        loadout = st.loadout;
        await markPhaseStatus(supabase, runId, "strategy", "succeeded", {
          thinEvidence,
          cappedAggressiveness: strategyOptions.posting_aggressiveness,
        });
        await markPhaseStatus(supabase, runId, "loadout", "succeeded", {
          total: loadout.total_videos_planned,
        });
      }

      // --- concepts ---
      if (shouldRunPhase("concepts", resumeAfter, execCtx) && report && strategy && loadout) {
        await setPhase(supabase, runId, "concepts");
        await markPhaseStatus(supabase, runId, "concepts", "running");
        const concepts = await generateVideoConcepts({
          projectId: input.projectId,
          growthRunId: runId,
          ownerId: input.ownerId,
          trendReport: report,
          strategy,
          loadout,
          options: runOptions,
        });
        await markPhaseStatus(supabase, runId, "concepts", "succeeded", {
          count: concepts.conceptIds.length,
        });
        await gate({
          client: supabase,
          growthRunId: runId,
          ownerId: input.ownerId,
          phase: "concepts",
          policy: approvalPolicy,
        });
      }

      const conceptIds = await loadConceptIdsForStage3(
        supabase,
        input.projectId,
        runId,
        parentRunId
      );

      if (
        execCtx.executionMode === "stage_only" &&
        execCtx.targetStage === 3 &&
        conceptIds.length === 0
      ) {
        throw new Error(
          "No concepts with scripts and storyboards. Run Stage 2 before regenerating videos."
        );
      }

      // --- scripts + storyboards (stage 2 tail) ---
      let justCompletedStage2 = false;
      if (shouldRunPhase("scripts", resumeAfter, execCtx) && conceptIds.length > 0) {
        await setPhase(supabase, runId, "scripts");
        await markPhaseStatus(supabase, runId, "scripts", "running");
        const scripted = await buildScriptsAndStoryboardsForRun({
          projectId: input.projectId,
          conceptIds,
          growthRunId: runId,
        });
        await markPhaseStatus(supabase, runId, "scripts", "succeeded", {
          count: scripted.completedConceptIds.length,
          failures: scripted.failures.length,
        });
        await markPhaseStatus(supabase, runId, "storyboards", "succeeded", {
          count: scripted.completedConceptIds.length,
          failures: scripted.failures.length,
        });
        if (scripted.failures.length > 0) {
          throw new Error(
            `Storyboard generation failed for ${scripted.failures.length} concept(s): ${scripted.failures[0]?.error ?? "unknown"}`
          );
        }
        justCompletedStage2 = true;
      }

      if (justCompletedStage2) {
        await maybePauseAtStageBoundary({
          client: supabase,
          growthRunId: runId,
          stage: 2,
          boundaryPhase: "storyboards",
        });
      }

      // --- render pipeline (stage 3) ---
      let justCompletedStage3 = false;
      if (shouldRunPhase("assets", resumeAfter, execCtx) && conceptIds.length > 0) {
        await setPhase(supabase, runId, "assets");
        await markPhaseStatus(supabase, runId, "assets", "running");
        const built = await renderVideosForRun({
          growthRunId: runId,
          projectId: input.projectId,
          conceptIds,
          connectedAccountIds: runOptions.connected_account_ids,
        });
        videoIds = built.videoIds;
        failures = built.failures;
        const { data: renderedVideos } = videoIds.length
          ? await supabase
              .from("videos")
              .select("id, status")
              .in("id", videoIds)
          : { data: [] };
        const readyVideoIds = (renderedVideos ?? [])
          .filter((video) => video.status === "ready")
          .map((video) => video.id);

        if (failures.length > 0 || readyVideoIds.length !== videoIds.length || videoIds.length === 0) {
          const notReadyCount = Math.max(videoIds.length - readyVideoIds.length, 0);
          const reason =
            failures[0]?.error ??
            (videoIds.length === 0
              ? "No videos were rendered."
              : `${notReadyCount} video(s) did not reach ready status.`);
          await markPhaseStatus(supabase, runId, "assets", "failed", {
            rendered: readyVideoIds.length,
            attempted: conceptIds.length,
            failures: failures.length,
            notReady: notReadyCount,
            error: reason,
          });
          await markPhaseStatus(supabase, runId, "videos", "failed", {
            count: readyVideoIds.length,
            attempted: videoIds.length,
          });
          await markPhaseStatus(supabase, runId, "captions", "skipped", {
            reason: "Video rendering did not complete.",
          });
          throw new Error(
            `Video rendering failed for Stage 3: ${reason}`
          );
        }

        await markPhaseStatus(supabase, runId, "assets", "succeeded", {
          failures: 0,
        });
        await markPhaseStatus(supabase, runId, "videos", "succeeded", {
          count: readyVideoIds.length,
        });
        await markPhaseStatus(supabase, runId, "captions", "succeeded");

        await setPhase(supabase, runId, "approval", { status: "awaiting_approval" });

        const autoApproveVideos =
          approvalPolicy === "auto_approve_all" || runOptions.approval_mode === "autopilot";

        if (autoApproveVideos) {
          await supabase
            .from("videos")
            .update({
              status: "approved",
              approval_status: "auto_approved",
              approved_at: new Date().toISOString(),
            })
            .eq("growth_run_id", runId)
            .eq("status", "ready");
        } else if (runOptions.approval_mode === "per_format") {
          await supabase
            .from("videos")
            .update({
              status: "approved",
              approval_status: "auto_approved",
              approved_at: new Date().toISOString(),
            })
            .eq("growth_run_id", runId)
            .eq("status", "ready")
            .in(
              "concept_id",
              (
                await supabase
                  .from("video_concepts")
                  .select("id")
                  .eq("growth_run_id", runId)
                  .in("video_type", ["slide", "founder_pov", "pain_led"])
              ).data?.map((r) => r.id) ?? []
            );
        }

        await markPhaseStatus(supabase, runId, "approval", "succeeded");
        justCompletedStage3 = true;
      }

      if (justCompletedStage3) {
        await maybePauseAtStageBoundary({
          client: supabase,
          growthRunId: runId,
          stage: 3,
          boundaryPhase: "approval",
        });
      }

      return {
        growthRunId: runId,
        status: "completed",
        videoIds,
        failures,
      };
    } catch (err) {
      if (err instanceof RunPausedForApprovalError) {
        return {
          growthRunId: runId,
          status: "awaiting_user_input",
          videoIds,
          failures,
          pausedAtPhase: err.phase,
        };
      }

      const message = err instanceof Error ? err.message : String(err);
      const { data: current } = await supabase
        .from("growth_runs")
        .select("phase, phase_status")
        .eq("id", runId)
        .single();
      const failedPhase = current?.phase ?? "brief";
      const phaseStatus = (current?.phase_status ?? {}) as Record<string, unknown>;
      phaseStatus[failedPhase] = {
        status: "failed",
        at: new Date().toISOString(),
        error: message.slice(0, 2000),
      };
      await supabase
        .from("growth_runs")
        .update({
          status: "failed",
          error: message,
          phase_status: phaseStatus as never,
          completed_at: new Date().toISOString(),
        })
        .eq("id", runId);
      throw new GrowthRunExecutionError(runId, message, {
        cause: err instanceof Error ? err : undefined,
      });
    }
  });
}

export interface RunGrowthRunStageOnlyInput {
  projectId: string;
  ownerId: string;
  stage: GrowthRunStageId;
  priorRunId?: string;
  /** When set, execute this pending run instead of creating a new row. */
  growthRunId?: string;
  options?: Partial<GrowthRunOptions>;
  approvalMode?: "manual" | "per_format" | "autopilot";
  postingAggressiveness?: "conservative" | "balanced" | "aggressive";
  targetPlatforms?: Array<"tiktok" | "instagram" | "youtube">;
  brandConstraints?: Record<string, unknown>;
  distributionMode?: "postiz" | "export_only";
  productUrl?: string;
}

/**
 * Create (or reuse) a Growth Run scoped to one macro stage and execute it.
 * Repeat projects only — first run stays on the sequential gated flow.
 */
export async function runGrowthRunStageOnly(
  input: RunGrowthRunStageOnlyInput
): Promise<StartGrowthRunResult> {
  const supabase = createSupabaseServerClient();

  const eligible = await projectHasRepeatRunEligibility(supabase, input.projectId);
  if (!eligible) {
    throw new Error("Complete your first Growth Run before running individual stages.");
  }

  const { data: project } = await supabase
    .from("projects")
    .select("product_url")
    .eq("id", input.projectId)
    .maybeSingle();
  const productUrl = input.productUrl ?? project?.product_url ?? undefined;

  const pre = await validateStagePreconditions(supabase, input.projectId, input.stage, {
    growthRunId: input.growthRunId ?? input.priorRunId,
    productUrl,
  });
  if (!pre.ok) throw new Error(pre.error);

  if (input.stage === 4) {
    const scheduleRunId = pre.parentRunId ?? input.priorRunId ?? input.growthRunId;
    if (!scheduleRunId) {
      throw new Error("No run with approved videos found.");
    }
    return prepareStage4Schedule({
      growthRunId: scheduleRunId,
      projectId: input.projectId,
      ownerId: input.ownerId,
    });
  }

  if (input.growthRunId) {
    return runGrowthRunStage({
      growthRunId: input.growthRunId,
      ownerId: input.ownerId,
      stage: input.stage,
    });
  }

  const runOptions = {
    ...(input.options ?? {}),
    ...(input.stage === 1
      ? {
          unified: true,
          product_url: productUrl,
          unified_profile: "project" as const,
        }
      : {}),
  };

  const run = await createGrowthRun({
    projectId: input.projectId,
    options: runOptions as Record<string, unknown>,
    trigger: "manual",
    approvalMode: input.approvalMode,
    postingAggressiveness: input.postingAggressiveness,
    targetPlatforms: input.targetPlatforms,
    brandConstraints: input.brandConstraints,
    distributionMode: input.distributionMode,
    parentRunId: pre.parentRunId ?? input.priorRunId ?? null,
    executionMode: "stage_only",
    targetStage: input.stage,
    client: supabase,
  });

  return startGrowthRun({
    projectId: input.projectId,
    ownerId: input.ownerId,
    existingRunId: run.id,
    executionMode: "stage_only",
    targetStage: input.stage,
    unified: input.stage === 1,
    productUrl,
    options: input.options,
  });
}

/** Run a single macro stage on an existing Growth Run (repeat / stage-only mode). */
export async function runGrowthRunStage(input: {
  growthRunId: string;
  ownerId: string;
  stage: GrowthRunStageId;
}): Promise<StartGrowthRunResult> {
  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select("id, project_id, options, parent_run_id, execution_mode, target_stage")
    .eq("id", input.growthRunId)
    .single();

  if (!run) throw new Error("Growth run not found.");

  if (input.stage === 4) {
    return prepareStage4Schedule({
      growthRunId: run.id,
      projectId: run.project_id,
      ownerId: input.ownerId,
    });
  }

  const stored = (run.options ?? {}) as Record<string, unknown>;
  const opts = parseGrowthRunOptions(run.options);
  const productUrl =
    typeof stored.product_url === "string"
      ? stored.product_url
      : (
          await supabase
            .from("projects")
            .select("product_url")
            .eq("id", run.project_id)
            .maybeSingle()
        ).data?.product_url ?? undefined;

  const pre = await validateStagePreconditions(supabase, run.project_id, input.stage, {
    growthRunId: run.id,
    productUrl,
  });
  if (!pre.ok) throw new Error(pre.error);

  const resumeAfter = getResumePhaseBeforeStage(input.stage);
  const unified = input.stage === 1 || stored.unified === true;

  return startGrowthRun({
    projectId: run.project_id,
    ownerId: input.ownerId,
    existingRunId: run.id,
    resumeAfterPhase: resumeAfter,
    executionMode: "stage_only",
    targetStage: input.stage,
    unified,
    productUrl,
    crawlId: typeof stored.crawl_id === "string" ? stored.crawl_id : undefined,
    profile:
      stored.unified_profile === "signup" || stored.unified_profile === "project"
        ? stored.unified_profile
        : "project",
    options: opts,
  });
}

async function prepareStage4Schedule(input: {
  growthRunId: string;
  projectId: string;
  ownerId: string;
}): Promise<StartGrowthRunResult> {
  const supabase = createSupabaseServerClient();
  const pre = await validateStagePreconditions(supabase, input.projectId, 4, {
    growthRunId: input.growthRunId,
  });
  if (!pre.ok) throw new Error(pre.error);

  const scheduleRunId = pre.parentRunId ?? input.growthRunId;

  const { data: videos } = await supabase
    .from("videos")
    .select("id, status, approval_status")
    .eq("growth_run_id", scheduleRunId);

  const rows = videos ?? [];
  const allReady = rows.length > 0 && rows.every((v) => v.status === "ready");
  if (!allReady) {
    throw new Error("All videos must reach ready status before scheduling.");
  }
  const allApproved = rows.every(
    (v) => v.approval_status === "approved" || v.approval_status === "auto_approved"
  );
  if (!allApproved) {
    throw new Error("Approve all videos in the production workspace before scheduling.");
  }

  await supabase
    .from("growth_runs")
    .update({
      status: "awaiting_approval",
      phase: "schedule",
      current_stage: 4,
      paused_at_phase: null,
      execution_mode: "stage_only",
      target_stage: 4,
    })
    .eq("id", scheduleRunId);

  return {
    growthRunId: scheduleRunId,
    status: "awaiting_approval",
    videoIds: rows.map((r) => r.id),
    failures: [],
  };
}

export async function finalizeStageOnlyRun(input: {
  growthRunId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select("execution_mode, paused_at_phase")
    .eq("id", input.growthRunId)
    .single();

  if (!run || run.execution_mode !== "stage_only") {
    throw new Error("Only stage-only runs can be finalized this way.");
  }

  await supabase
    .from("growth_runs")
    .update({
      status: "completed",
      paused_at_phase: null,
      completed_at: new Date().toISOString(),
    })
    .eq("id", input.growthRunId);
}

export async function resumeGrowthRun(input: {
  growthRunId: string;
  ownerId: string;
}): Promise<StartGrowthRunResult> {
  return continueGrowthRunStage(input);
}

/** Continue after a stage boundary pause (or legacy micro-gate). */
export async function continueGrowthRunStage(input: {
  growthRunId: string;
  ownerId: string;
}): Promise<StartGrowthRunResult> {
  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select(
      "id, project_id, paused_at_phase, phase, options, status, current_stage, execution_mode, target_stage"
    )
    .eq("id", input.growthRunId)
    .single();

  if (!run) throw new Error("Growth run not found.");
  if (run.status !== "awaiting_user_input" && run.status !== "failed") {
    throw new Error("Run is not waiting for user input or retry.");
  }

  if (run.execution_mode === "stage_only") {
    throw new Error(
      "This was a stage-only run. Mark it complete or start the next stage from the Growth hub."
    );
  }

  if (run.status === "awaiting_user_input" && run.paused_at_phase === "approval") {
    const { data: videos } = await supabase
      .from("videos")
      .select("id, status, approval_status")
      .eq("growth_run_id", run.id);

    const rows = videos ?? [];
    if (rows.length === 0) {
      throw new Error("No rendered videos yet. Generate videos before scheduling.");
    }
    const allReady = rows.every((v) => v.status === "ready");
    if (!allReady) {
      throw new Error("All videos must reach ready status before scheduling.");
    }
    const allApproved = rows.every(
      (v) => v.approval_status === "approved" || v.approval_status === "auto_approved"
    );
    if (!allApproved) {
      throw new Error("Approve all videos in the production workspace before scheduling.");
    }

    await supabase
      .from("growth_runs")
      .update({
        status: "awaiting_approval",
        phase: "schedule",
        current_stage: 4,
        paused_at_phase: null,
      })
      .eq("id", run.id);

    return {
      growthRunId: run.id,
      status: "awaiting_approval",
      videoIds: rows.map((r) => r.id),
      failures: [],
    };
  }

  const opts = parseGrowthRunOptions(run.options);
  const stored = (run.options ?? {}) as Record<string, unknown>;

  const resumeAfterPhase =
    run.status === "failed" ? previousUnifiedPhase(run.phase ?? "autobrief") : run.paused_at_phase;

  return startGrowthRun({
    projectId: run.project_id,
    ownerId: input.ownerId,
    existingRunId: run.id,
    resumeAfterPhase,
    unified: stored.unified === true,
    productUrl: typeof stored.product_url === "string" ? stored.product_url : undefined,
    crawlId: typeof stored.crawl_id === "string" ? stored.crawl_id : undefined,
    options: opts,
  });
}

function parseGrowthRunOptions(raw: unknown): Partial<GrowthRunOptions> {
  if (raw && typeof raw === "object" && !Array.isArray(raw)) {
    return GrowthRunOptionsSchema.partial().parse(raw);
  }
  return {};
}

export async function rejectGrowthRunPhase(input: {
  growthRunId: string;
}): Promise<void> {
  const supabase = createSupabaseServerClient();
  await supabase
    .from("growth_runs")
    .update({
      status: "cancelled",
      completed_at: new Date().toISOString(),
      notes: "Cancelled by user at approval gate.",
    })
    .eq("id", input.growthRunId);
}
