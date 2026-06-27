"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ProviderMode } from "@/lib/provider-mode";
import type { AutoBrief } from "@/services/autobrief/schema";
import {
  beginAutoBriefRunAction,
  beginOnboardingGrowthRunAction,
  executeAutoBriefRunAction,
  executeOnboardingGrowthRunAction,
} from "@/app/(app)/autobrief/actions";
import {
  OnboardingPipelineShell,
  type PipelineStage,
} from "@/components/onboarding/onboarding-pipeline-shell";
import { useAutobriefProgress } from "@/hooks/use-autobrief-progress";
import { useGrowthRunProgress } from "@/hooks/use-growth-run-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const AUTOBRIEF_TIMEOUT_MS = 240_000;
const GROWTH_RUN_TIMEOUT_MS = 600_000;

export function OnboardingWizard({ initialProviderMode: _initialProviderMode }: { initialProviderMode: ProviderMode }) {
  const router = useRouter();
  const [step, setStep] = useState<"url" | "running" | "error">("url");
  const [productUrl, setProductUrl] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [crawlId, setCrawlId] = useState<string | null>(null);
  const [growthRunId, setGrowthRunId] = useState<string | null>(null);
  const [brief, setBrief] = useState<AutoBrief | null>(null);
  const [stage, setStage] = useState<PipelineStage>("crawl");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slowHint, setSlowHint] = useState(false);
  const [isRunning, setIsRunning] = useState(false);
  const [pending, startTransition] = useTransition();
  const runIdRef = useRef(0);

  const autobriefProgress = useAutobriefProgress(
    projectId,
    crawlId,
    step === "running" && stage === "crawl"
  );
  const growthProgress = useGrowthRunProgress(
    projectId,
    growthRunId,
    step === "running" && (stage === "growth" || stage === "done")
  );

  useEffect(() => {
    if (step !== "running") {
      setSlowHint(false);
      return;
    }
    const timer = setTimeout(() => setSlowHint(true), 90_000);
    return () => clearTimeout(timer);
  }, [step]);

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
    setBrief(null);
    setStage("crawl");

    void (async () => {
      const begin = await beginAutoBriefRunAction({ productUrl });
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
      });

      let briefResult: Awaited<ReturnType<typeof executeAutoBriefRunAction>>;
      try {
        briefResult = await withTimeout(
          executeAutoBriefRunAction({
            projectId: begin.projectId,
            crawlId: begin.crawlId,
            productUrl,
            profile: "signup",
          }),
          AUTOBRIEF_TIMEOUT_MS
        );
      } catch (err) {
        if (runIdRef.current !== runId) return;
        setErrorMessage(err instanceof Error ? err.message : "AutoBrief timed out.");
        setStage("failed");
        setStep("error");
        setIsRunning(false);
        return;
      }

      if (runIdRef.current !== runId) return;

      if (!briefResult.ok) {
        setErrorMessage(briefResult.error);
        setStage("failed");
        setStep("error");
        setIsRunning(false);
        return;
      }

      if (briefResult.fetchWarning) toast.warning(briefResult.fetchWarning);

      flushSync(() => {
        setBrief(briefResult.brief);
        setStage("brief");
      });

      const growthBegin = await beginOnboardingGrowthRunAction({ projectId: begin.projectId });
      if (runIdRef.current !== runId) return;

      if (!growthBegin.ok) {
        setErrorMessage(growthBegin.error);
        setStage("failed");
        setStep("error");
        setIsRunning(false);
        return;
      }

      flushSync(() => {
        setGrowthRunId(growthBegin.growthRunId);
        setStage("growth");
      });

      startTransition(async () => {
        let growthResult: Awaited<ReturnType<typeof executeOnboardingGrowthRunAction>>;
        try {
          growthResult = await withTimeout(
            executeOnboardingGrowthRunAction({
              projectId: begin.projectId,
              growthRunId: growthBegin.growthRunId,
            }),
            GROWTH_RUN_TIMEOUT_MS
          );
        } catch (err) {
          if (runIdRef.current !== runId) return;
          setErrorMessage(err instanceof Error ? err.message : "Growth Run timed out.");
          setStage("failed");
          setStep("error");
          setIsRunning(false);
          return;
        }

        if (runIdRef.current !== runId) return;

        if (!growthResult.ok) {
          setErrorMessage(growthResult.error);
          setStage("failed");
          if (growthResult.growthRunId) {
            router.push(`/projects/${begin.projectId}/growth/${growthResult.growthRunId}`);
          } else {
            setStep("error");
          }
          setIsRunning(false);
          return;
        }

        setStage("done");
        setIsRunning(false);
        router.push(`/projects/${begin.projectId}/growth/${growthResult.growthRunId}`);
        router.refresh();
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
            AutoScale reads your site, saves your product brief internally, and launches your first Growth Run automatically.
          </p>
        </div>
        <div className="flex justify-end pt-2">
          <Button type="button" disabled={isRunning || pending} onClick={onStart}>
            {isRunning || pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Start Growth Run
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
          brief={brief}
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
      brief={brief}
      showSlowHint={slowHint}
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
