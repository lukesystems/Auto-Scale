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
import { buildVideosForRun } from "@/services/video-factory";
import { runAutobriefPhase } from "./run-autobrief-phase";
import { runTrendhopPhase } from "./run-trendhop-phase";
import {
  maybePauseForUserApproval,
  RunPausedForApprovalError,
} from "./approval-gates";
import type { ApprovalGatePhase } from "@/lib/approval-policy";
import { getUserApprovalPolicy } from "@/lib/user-approval-settings";
import { withProjectAIContext, getProjectAIModelSlug } from "@/services/ai/runtime";

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

function shouldRunPhase(phase: UnifiedRunPhase, resumeAfterPhase: string | null): boolean {
  if (!resumeAfterPhase) return true;
  return phaseIndex(phase) > phaseIndex(resumeAfterPhase);
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
        client: supabase,
      });

  const runId = run.id;
  const resumeAfter = input.resumeAfterPhase ?? null;

  if (input.existingRunId || input.resumeAfterPhase) {
    await supabase
      .from("growth_runs")
      .update({
        status: "running",
        paused_at_phase: null,
        started_at: new Date().toISOString(),
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
        .select("options")
        .eq("id", runId)
        .single();
      const storedOpts = (runRow?.options ?? {}) as Record<string, unknown>;
      const unified = input.unified ?? storedOpts.unified === true;
      const productUrl =
        input.productUrl ??
        (typeof storedOpts.product_url === "string" ? storedOpts.product_url : null);
      const crawlId =
        input.crawlId ??
        (typeof storedOpts.crawl_id === "string" ? storedOpts.crawl_id : null);

      // --- autobrief ---
      if (unified && productUrl && shouldRunPhase("autobrief", resumeAfter)) {
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
      if (shouldRunPhase("deep_discovery", resumeAfter)) {
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
      if (shouldRunPhase("trendhop", resumeAfter)) {
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
      let conceptIds: string[] = [];

      if (!shouldRunPhase("videotrend", resumeAfter)) {
        const { data: existingReport } = await supabase
          .from("video_trend_reports")
          .select("*")
          .eq("growth_run_id", runId)
          .maybeSingle();
        if (existingReport) {
          report = {
            confidence: existingReport.confidence,
            winning_structures: existingReport.winning_structures as never,
            hook_patterns: existingReport.hook_patterns as never,
            opening_frames: existingReport.opening_frames as never,
            cta_patterns: existingReport.cta_patterns as never,
            audience_language: existingReport.audience_language as never,
            platform_patterns: existingReport.platform_patterns as never,
            recommended_experiments: existingReport.recommended_experiments as never,
            competitor_gaps: existingReport.competitor_gaps as never,
            repurposable_formats: existingReport.repurposable_formats as never,
            evidence_video_ids: existingReport.evidence_video_ids as never,
          } as Awaited<ReturnType<typeof generateVideoTrendReport>>["report"];
        }
        const { data: existingStrategy } = await supabase
          .from("video_strategies")
          .select("*, posting_loadouts(*)")
          .eq("growth_run_id", runId)
          .maybeSingle();
        if (existingStrategy) {
          strategy = existingStrategy as never;
          const loadoutRow = (existingStrategy as { posting_loadouts?: unknown }).posting_loadouts;
          if (loadoutRow && typeof loadoutRow === "object") {
            loadout = loadoutRow as never;
          }
        }
      }

      // --- videotrend ---
      if (shouldRunPhase("videotrend", resumeAfter)) {
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
      }

      const thinEvidence =
        discovery.lowConfidence || (report?.confidence ?? 1) < 0.35;
      const strategyOptions =
        thinEvidence && runOptions.posting_aggressiveness !== "conservative"
          ? { ...runOptions, posting_aggressiveness: "conservative" as const }
          : runOptions;

      // --- strategy + loadout ---
      if (shouldRunPhase("strategy", resumeAfter) && report) {
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
      if (shouldRunPhase("concepts", resumeAfter) && report && strategy && loadout) {
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
        conceptIds = concepts.conceptIds;
        await markPhaseStatus(supabase, runId, "concepts", "succeeded", {
          count: conceptIds.length,
        });
        await gate({
          client: supabase,
          growthRunId: runId,
          ownerId: input.ownerId,
          phase: "concepts",
          policy: approvalPolicy,
        });
      } else if (!shouldRunPhase("concepts", resumeAfter) && resumeAfter) {
        const { data: existing } = await supabase
          .from("video_concepts")
          .select("id")
          .eq("growth_run_id", runId);
        conceptIds = (existing ?? []).map((r) => r.id);
      }

      // --- render pipeline ---
      if (shouldRunPhase("videos", resumeAfter) && conceptIds.length > 0) {
        await setPhase(supabase, runId, "videos");
        await markPhaseStatus(supabase, runId, "scripts", "running");
        const built = await buildVideosForRun({
          growthRunId: runId,
          projectId: input.projectId,
          conceptIds,
          connectedAccountIds: runOptions.connected_account_ids,
        });
        videoIds = built.videoIds;
        failures = built.failures;
        await markPhaseStatus(supabase, runId, "scripts", "succeeded");
        await markPhaseStatus(supabase, runId, "storyboards", "succeeded");
        await markPhaseStatus(supabase, runId, "assets", "succeeded", {
          failures: failures.length,
        });
        await markPhaseStatus(supabase, runId, "videos", "succeeded", {
          count: videoIds.length,
        });
        await markPhaseStatus(supabase, runId, "captions", "succeeded");
      }

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
          .in("status", ["rendering", "ready"]);
      } else if (runOptions.approval_mode === "per_format") {
        await supabase
          .from("videos")
          .update({
            status: "approved",
            approval_status: "auto_approved",
            approved_at: new Date().toISOString(),
          })
          .eq("growth_run_id", runId)
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

      await gate({
        client: supabase,
        growthRunId: runId,
        ownerId: input.ownerId,
        phase: "videos",
        policy: approvalPolicy,
      });

      return {
        growthRunId: runId,
        status: "awaiting_approval",
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

export async function resumeGrowthRun(input: {
  growthRunId: string;
  ownerId: string;
}): Promise<StartGrowthRunResult> {
  const supabase = createSupabaseServerClient();
  const { data: run } = await supabase
    .from("growth_runs")
    .select("id, project_id, paused_at_phase, options, status")
    .eq("id", input.growthRunId)
    .single();

  if (!run) throw new Error("Growth run not found.");
  if (run.status !== "awaiting_user_input") {
    throw new Error("Run is not waiting for user input.");
  }

  const opts = parseGrowthRunOptions(run.options);
  const stored = (run.options ?? {}) as Record<string, unknown>;

  return startGrowthRun({
    projectId: run.project_id,
    ownerId: input.ownerId,
    existingRunId: run.id,
    resumeAfterPhase: run.paused_at_phase,
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
