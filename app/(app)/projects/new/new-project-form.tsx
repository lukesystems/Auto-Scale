"use client";

import { useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Globe, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import {
  beginUnifiedRunAction,
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

export function NewProjectForm({
  onSuccess,
  initialUrl = "",
}: {
  onSuccess?: () => void;
  initialUrl?: string;
} = {}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState(initialUrl);
  const [aiModel, setAiModel] = useState<ModelPickerValue>(getDefaultModelPickerValue);
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [crawlId, setCrawlId] = useState<string | null>(null);
  const [growthRunId, setGrowthRunId] = useState<string | null>(null);
  const [stage, setStage] = useState<PipelineStage>("crawl");
  const runIdRef = useRef(0);

  useEffect(() => {
    if (initialUrl) setProductUrl(initialUrl);
  }, [initialUrl]);

  const autobriefProgress = useAutobriefProgress(
    projectId,
    crawlId,
    isBootstrapping && (stage === "crawl" || stage === "brief")
  );
  const growthProgress = useGrowthRunProgress(
    projectId,
    growthRunId,
    isBootstrapping && (stage === "growth" || stage === "done")
  );

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const url = productUrl.trim();
    if (!url) {
      toast.error("Enter your product URL.");
      return;
    }

    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    setError(null);
    setIsBootstrapping(true);
    setProjectId(null);
    setCrawlId(null);
    setGrowthRunId(null);
    setStage("crawl");

    void (async () => {
      const begin = await beginUnifiedRunAction({
        productUrl: url,
        aiModel,
        profile: "project",
      });
      if (runIdRef.current !== runId) return;

      if (!begin.ok) {
        setError(begin.error);
        setIsBootstrapping(false);
        toast.error(begin.error);
        return;
      }

      flushSync(() => {
        setProjectId(begin.projectId);
        setCrawlId(begin.crawlId);
        setGrowthRunId(begin.growthRunId);
        setStage("growth");
      });

      toast.success("Project created — starting AutoScale run…");
      onSuccess?.();
      router.push(
        `/projects/${begin.projectId}/growth/${begin.growthRunId}?autoExecute=1`
      );
      setIsBootstrapping(false);
    })();
  }

  if (isBootstrapping) {
    return (
      <OnboardingPipelineShell
        stage={stage}
        autobriefProgress={autobriefProgress}
        growthProgress={growthProgress}
        brief={null}
        title="Starting AutoScale…"
        subtitle="Understanding your product, discovering evidence, and producing your first video experiments."
      />
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-6">
      <div className="space-y-1.5">
        <Label htmlFor="product_url">Product URL</Label>
        <div className="relative">
          <Globe className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            id="product_url"
            name="product_url"
            type="url"
            required
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://yourproduct.com"
            className="pl-9"
            disabled={isBootstrapping}
          />
        </div>
      </div>

      <ModelPicker value={aiModel} onChange={setAiModel} disabled={isBootstrapping} />

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button
          type="button"
          variant="outline"
          onClick={() => (onSuccess ? onSuccess() : router.back())}
          disabled={isBootstrapping}
        >
          Cancel
        </Button>
        <Button
          type="submit"
          disabled={isBootstrapping || !productUrl.trim()}
          size="lg"
          variant="glow"
        >
          {isBootstrapping ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          Start AutoScale
        </Button>
      </div>
    </form>
  );
}
