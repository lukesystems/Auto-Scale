"use client";

import { useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ProviderMode } from "@/lib/provider-mode";
import {
  beginUnifiedRunAction,
  executeUnifiedRunAction,
} from "@/app/(app)/unified-run/actions";
import {
  OnboardingPipelineShell,
  type PipelineStage,
} from "@/components/onboarding/onboarding-pipeline-shell";
import { useAutobriefProgress } from "@/hooks/use-autobrief-progress";
import { useGrowthRunProgress } from "@/hooks/use-growth-run-progress";
import {
  ModelPicker,
  getDefaultModelPickerValue,
  type ModelPickerValue,
} from "@/components/ai/model-picker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const UNIFIED_RUN_TIMEOUT_MS = 900_000;

export function OnboardingWizard({
  initialProviderMode: _initialProviderMode,
}: {
  initialProviderMode: ProviderMode;
}) {
  const router = useRouter();
  const [step, setStep] = useState<"url" | "running" | "error">("url");
  const [productUrl, setProductUrl] = useState("");
  const [aiModel, setAiModel] = useState<ModelPickerValue>(getDefaultModelPickerValue);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [crawlId, setCrawlId] = useState<string | null>(null);
  const [growthRunId, setGrowthRunId] = useState<string | null>(null);
  const [stage, setStage] = useState<PipelineStage>("crawl");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [pending, startTransition] = useTransition();
  const runIdRef = useRef(0);

  const autobriefProgress = useAutobriefProgress(
    projectId,
    crawlId,
    step === "running" && (stage === "crawl" || stage === "brief")
  );
  const growthProgress = useGrowthRunProgress(
    projectId,
    growthRunId,
    step === "running" && (stage === "growth" || stage === "done")
  );

  function onStart() {
    if (!productUrl.trim()) {
      toast.error("Paste your product URL first.");
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setStep("running");
    setIsRunning(true);
    setErrorMessage(null);
    setProjectId(null);
    setCrawlId(null);
    setGrowthRunId(null);
    setStage("crawl");

    void (async () => {
      const begin = await beginUnifiedRunAction({
        productUrl,
        aiModel,
        profile: "signup",
      });
      if (runIdRef.current !== runId) return;

      if (!begin.ok) {
        setErrorMessage(begin.error);
        setStage("failed");
        setStep("error");
        setIsRunning(false);
        return;
      }

      flushSync(() => {
        setProjectId(begin.projectId);
        setCrawlId(begin.crawlId);
        setGrowthRunId(begin.growthRunId);
        setStage("growth");
      });

      startTransition(async () => {
        try {
          const result = await withTimeout(
            executeUnifiedRunAction({
              projectId: begin.projectId,
              growthRunId: begin.growthRunId,
              productUrl: begin.normalizedUrl,
              crawlId: begin.crawlId,
              profile: "signup",
            }),
            UNIFIED_RUN_TIMEOUT_MS
          );

          if (runIdRef.current !== runId) return;

          if (!result.ok) {
            setErrorMessage(result.error);
            setStage("failed");
            setStep("error");
            setIsRunning(false);
            if (result.growthRunId) {
              router.push(`/projects/${begin.projectId}/growth/${result.growthRunId}`);
            }
            return;
          }

          setStage("done");
          setIsRunning(false);
          router.push(`/projects/${begin.projectId}/growth/${result.growthRunId}`);
          router.refresh();
        } catch (err) {
          if (runIdRef.current !== runId) return;
          setErrorMessage(err instanceof Error ? err.message : "AutoScale timed out.");
          setStage("failed");
          setStep("error");
          setIsRunning(false);
        }
      });
    })();
  }

  function returnToUrl() {
    runIdRef.current += 1;
    setIsRunning(false);
    setStep("url");
  }

  if (step === "url") {
    return (
      <div className="space-y-5">
        <div className="space-y-1.5">
          <Label htmlFor="product_url">Paste your product URL</Label>
          <Input
            id="product_url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://yourproduct.com"
            onKeyDown={(e) => {
              if (e.key === "Enter" && !isRunning) onStart();
            }}
          />
          <p className="text-xs text-muted-foreground">
            AutoScale runs end to end: product brief, discovery, trend hops, video experiments, and scheduling.
          </p>
        </div>

        <ModelPicker value={aiModel} onChange={setAiModel} disabled={isRunning || pending} />

        <div className="flex justify-end pt-2">
          <Button type="button" disabled={isRunning || pending} onClick={onStart}>
            {isRunning || pending ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Sparkles className="h-4 w-4" />
            )}
            Start AutoScale
          </Button>
        </div>
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="space-y-4">
        <OnboardingPipelineShell
          stage="failed"
          autobriefProgress={autobriefProgress}
          growthProgress={growthProgress}
          brief={null}
          errorMessage={errorMessage}
        />
        <Button type="button" onClick={returnToUrl}>
          Try again
        </Button>
      </div>
    );
  }

  return (
    <OnboardingPipelineShell
      stage={stage}
      autobriefProgress={autobriefProgress}
      growthProgress={growthProgress}
      brief={null}
    />
  );
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(new Error(`Operation timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
