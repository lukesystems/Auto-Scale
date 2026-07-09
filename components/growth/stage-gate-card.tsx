"use client";

import { useTransition } from "react";
import Link from "next/link";
import { Loader2, Play, Settings2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { GROWTH_RUN_PHASE_LABELS } from "@/lib/growth-run/phase-labels";
import {
  getNextStageCta,
  getStageByBoundaryPhase,
  getStageById,
  isStageBoundaryPause,
  resolveRunStage,
} from "@/lib/growth-run/stages";
import { getNextGrowthRunPhase } from "@/lib/growth-run/next-phase";
import {
  continueGrowthRunStageAction,
  finalizeStageOnlyRunAction,
} from "@/app/(app)/projects/[id]/growth/actions";
import { CancelGrowthRunButton } from "@/components/growth/cancel-growth-run-button";
import { VideoOutputModePicker, AdvancedProductionSettings } from "@/components/growth/production-format-picker";
import { AudioModePicker } from "@/components/growth/audio-mode-picker";
import { ProductionProviderBar, type ProductionProviderStatus } from "@/components/growth/production-provider-bar";
import { Stage3RerunButton } from "@/components/growth/stage3-rerun-button";
import type { AudioMode, QualityTier, VideoOutputMode, VisualPipeline } from "@/services/video-factory/production-options";

export interface StageGateSummary {
  briefName?: string | null;
  briefLine?: string | null;
  sourceCount?: number;
  videoEvidenceCount?: number;
  patternCount?: number;
  trendStructures?: number;
  trendConfidence?: number;
  conceptCount?: number;
  scriptCount?: number;
  storyboardCount?: number;
  scriptPreviews?: Array<{ hook: string; excerpt: string }>;
  videoCount?: number;
  approvedVideoCount?: number;
}

export function StageGateCard({
  projectId,
  growthRunId,
  pausedAtPhase,
  currentStage,
  executionMode,
  targetStage,
  summary,
  videoOutputMode = "kinetic_text_ad",
  audioMode = "voiceover_bgm",
  qualityTier = "standard",
  visualPipeline = "slide",
  providerStatus,
  canRerunStage3 = false,
}: {
  projectId: string;
  growthRunId: string;
  pausedAtPhase: string | null;
  currentStage?: number | null;
  executionMode?: "sequential_first" | "stage_only";
  targetStage?: number | null;
  summary: StageGateSummary;
  videoOutputMode?: VideoOutputMode;
  audioMode?: AudioMode;
  qualityTier?: QualityTier;
  visualPipeline?: VisualPipeline | "auto";
  providerStatus: ProductionProviderStatus;
  canRerunStage3?: boolean;
}) {
  const [pending, startTransition] = useTransition();
  const isStageOnly = executionMode === "stage_only";
  const stageOnlyDef = targetStage ? getStageById(targetStage) : undefined;
  const isStageGate = isStageBoundaryPause(pausedAtPhase);
  const stage = pausedAtPhase ? getStageByBoundaryPhase(pausedAtPhase) : undefined;
  const stageId = resolveRunStage({
    current_stage: currentStage,
    paused_at_phase: pausedAtPhase,
    status: "awaiting_user_input",
  });

  const completedLabel =
    GROWTH_RUN_PHASE_LABELS[pausedAtPhase ?? ""] ?? pausedAtPhase ?? "this step";
  const nextPhase = pausedAtPhase ? getNextGrowthRunPhase(pausedAtPhase) : null;
  const nextLabel = nextPhase ? GROWTH_RUN_PHASE_LABELS[nextPhase] ?? nextPhase : "the next step";
  const ctaLabel = isStageOnly
    ? "Mark stage complete"
    : isStageGate
      ? getNextStageCta(pausedAtPhase)
      : "Continue run";
  const showProductionPickers = isStageGate && pausedAtPhase === "storyboards";

  function onContinue(form?: HTMLFormElement | null) {
    startTransition(async () => {
      if (isStageOnly) {
        const result = await finalizeStageOnlyRunAction({ projectId, growthRunId });
        if (!result.ok) {
          toast.error(result.error ?? "Failed to finalize run.");
          return;
        }
        toast.success(
          stageOnlyDef
            ? `Stage ${stageOnlyDef.id} (${stageOnlyDef.title}) marked complete.`
            : "Stage run marked complete."
        );
        window.location.href = `/projects/${projectId}/growth`;
        return;
      }

      const videoOutputModeValue = form
        ? (new FormData(form).get("videoOutputMode") as VideoOutputMode | null)
        : null;
      const audioModeValue = form
        ? (new FormData(form).get("audioMode") as AudioMode | null)
        : null;

      const qualityTierValue = form
        ? (new FormData(form).get("qualityTier") as QualityTier | null)
        : null;

      const falModelTierValue = form
        ? (new FormData(form).get("falModelTier") as
            | "auto"
            | "fast"
            | "standard"
            | "cinematic"
            | null)
        : null;

      const visualPipelineValue = form
        ? (new FormData(form).get("visualPipeline") as VisualPipeline | "auto" | null)
        : null;

      const result = await continueGrowthRunStageAction({
        projectId,
        growthRunId,
        ...(videoOutputModeValue ? { videoOutputMode: videoOutputModeValue } : {}),
        ...(audioModeValue ? { audioMode: audioModeValue } : {}),
        ...(qualityTierValue ? { qualityTier: qualityTierValue } : {}),
        ...(falModelTierValue ? { falModelTier: falModelTierValue } : {}),
        ...(visualPipelineValue ? { visualPipeline: visualPipelineValue } : {}),
      });
      if (!result.ok) {
        toast.error(result.error ?? "Failed to continue.");
        return;
      }
      if (result.status === "awaiting_user_input") {
        toast.info("Paused again for your review.");
      } else if (result.status === "awaiting_approval" && pausedAtPhase === "approval") {
        toast.success("Ready to schedule — review the posting plan below.");
      } else {
        toast.success("Continuing AutoScale Shorts run…");
      }
      window.location.reload();
    });
  }

  return (
    <div className="rounded-xl border border-amber-500/40 bg-amber-500/5 p-4 space-y-4">
      <div>
        {isStageGate && stage ? (
          <>
            <p className="text-xs font-semibold uppercase tracking-wide text-amber-800 dark:text-amber-200">
              Stage {stage.id} complete — {stage.title}
            </p>
            <p className="text-sm font-semibold mt-1">{stage.rangeLabel}</p>
          </>
        ) : (
          <p className="text-sm font-semibold">Review before we continue</p>
        )}
        <p className="text-xs text-muted-foreground mt-1">
          <span className="font-medium text-foreground">{completedLabel}</span> is done.
          {!isStageGate ? (
            <>
              {" "}
              Review the evidence tabs below, then continue to start{" "}
              <span className="font-medium text-foreground">{nextLabel}</span>.
            </>
          ) : null}
        </p>
        <p className="text-xs text-muted-foreground mt-2">
          {isStageOnly ? (
            <>
              This was a stage-only run. Review the results below, then mark the stage complete or
              start another stage from the Growth hub.
            </>
          ) : (
            <>
              Macro stages always pause for your review. Micro-gates follow{" "}
              <Link href="/settings" className="underline hover:text-foreground inline-flex items-center gap-1">
                <Settings2 className="h-3 w-3" />
                Settings → Approval policy
              </Link>
              .
            </>
          )}
        </p>
      </div>

      {isStageGate ? <StageSummary stageId={stageId} summary={summary} /> : null}

      {showProductionPickers ? (
        <form
          id={`stage-gate-production-${growthRunId}`}
          className="space-y-4 rounded-lg border bg-background/80 p-4"
          onSubmit={(e) => {
            e.preventDefault();
            onContinue(e.currentTarget);
          }}
        >
          <ProductionProviderBar status={providerStatus} />
          <VideoOutputModePicker defaultValue={videoOutputMode} />
          <AudioModePicker defaultValue={audioMode} />
          <AdvancedProductionSettings
            defaultQualityTier={qualityTier}
            defaultVisualPipeline={visualPipeline}
            falConfigured={providerStatus.fal.ok}
          />
        </form>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() =>
            onContinue(
              showProductionPickers
                ? (document.getElementById(`stage-gate-production-${growthRunId}`) as HTMLFormElement)
                : null
            )
          }
          disabled={pending}
        >
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          {ctaLabel}
        </Button>
        <CancelGrowthRunButton
          projectId={projectId}
          growthRunId={growthRunId}
          runStatus="awaiting_user_input"
        />
        {canRerunStage3 && stageId === 3 ? (
          <Stage3RerunButton projectId={projectId} growthRunId={growthRunId} />
        ) : null}
      </div>
    </div>
  );
}

function StageSummary({
  stageId,
  summary,
}: {
  stageId: number;
  summary: StageGateSummary;
}) {
  if (stageId === 1) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <SummaryItem label="Product" value={summary.briefName ?? "Brief saved"} />
        <SummaryItem label="Tagline" value={summary.briefLine ?? "—"} />
        <SummaryItem label="Sources" value={String(summary.sourceCount ?? 0)} />
        <SummaryItem label="Video evidence" value={String(summary.videoEvidenceCount ?? 0)} />
        <SummaryItem label="Patterns" value={String(summary.patternCount ?? 0)} />
        <SummaryItem
          label="Winning structures"
          value={
            typeof summary.trendStructures === "number"
              ? `${summary.trendStructures} (${Math.round((summary.trendConfidence ?? 0) * 100)}% conf.)`
              : "—"
          }
        />
      </div>
    );
  }

  if (stageId === 2) {
    return (
      <div className="space-y-3 text-xs">
        <div className="grid gap-2 sm:grid-cols-3">
          <SummaryItem label="Concepts" value={String(summary.conceptCount ?? 0)} />
          <SummaryItem label="Scripts" value={String(summary.scriptCount ?? 0)} />
          <SummaryItem label="Storyboards" value={String(summary.storyboardCount ?? 0)} />
        </div>
        {(summary.scriptPreviews ?? []).length > 0 ? (
          <ul className="space-y-2">
            {summary.scriptPreviews!.slice(0, 3).map((script, i) => (
              <li key={i} className="rounded-md border bg-background/80 px-3 py-2">
                <p className="font-medium">{script.hook}</p>
                <p className="mt-1 text-muted-foreground line-clamp-2">{script.excerpt}</p>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-muted-foreground">
            Review strategy and concepts below before generating videos.
          </p>
        )}
      </div>
    );
  }

  if (stageId === 3) {
    return (
      <div className="grid gap-2 sm:grid-cols-2 text-xs">
        <SummaryItem label="Rendered videos" value={String(summary.videoCount ?? 0)} />
        <SummaryItem
          label="Approved"
          value={`${summary.approvedVideoCount ?? 0} / ${summary.videoCount ?? 0}`}
        />
        <p className="sm:col-span-2 text-muted-foreground">
          Approve each video in the Production Command Center, then continue to scheduling.
        </p>
      </div>
    );
  }

  return null;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-md border bg-background/80 px-3 py-2">
      <div className="text-[10px] uppercase tracking-wide text-muted-foreground">{label}</div>
      <div className="mt-0.5 font-medium">{value}</div>
    </div>
  );
}
