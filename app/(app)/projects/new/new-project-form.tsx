"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  beginAutoBriefRunAction,
  beginOnboardingGrowthRunAction,
  executeAutoBriefRunAction,
  executeOnboardingGrowthRunAction,
} from "@/app/(app)/autobrief/actions";
import { createProjectAction } from "./actions";
import {
  OnboardingPipelineShell,
  type PipelineStage,
} from "@/components/onboarding/onboarding-pipeline-shell";
import { useAutobriefProgress } from "@/hooks/use-autobrief-progress";
import { useGrowthRunProgress } from "@/hooks/use-growth-run-progress";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

const AUTOBRIEF_TIMEOUT_MS = 240_000;
const GROWTH_RUN_TIMEOUT_MS = 600_000;

const PLATFORMS = [
  { id: "tiktok", label: "TikTok" },
  { id: "instagram", label: "Instagram" },
  { id: "x", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "youtube", label: "YouTube Shorts" },
  { id: "threads", label: "Threads" },
];

export function NewProjectForm({
  onSuccess,
}: {
  onSuccess?: () => void;
} = {}) {
  const router = useRouter();
  const [mode, setMode] = useState<"url" | "manual">("url");
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [productUrl, setProductUrl] = useState("");
  const [isBootstrapping, setIsBootstrapping] = useState(false);
  const [projectId, setProjectId] = useState<string | null>(null);
  const [crawlId, setCrawlId] = useState<string | null>(null);
  const [growthRunId, setGrowthRunId] = useState<string | null>(null);
  const [brief, setBrief] = useState<import("@/services/autobrief/schema").AutoBrief | null>(null);
  const [stage, setStage] = useState<PipelineStage>("crawl");
  const runIdRef = useRef(0);
  const [selected, setSelected] = useState<string[]>(["linkedin", "x"]);
  const [form, setForm] = useState({
    name: "",
    product_url: "",
    niche: "",
    description: "",
    target_audience: "",
    offer: "",
    cta: "",
    competitors: "",
  });

  const autobriefProgress = useAutobriefProgress(
    projectId,
    crawlId,
    isBootstrapping && stage === "crawl"
  );
  const growthProgress = useGrowthRunProgress(
    projectId,
    growthRunId,
    isBootstrapping && (stage === "growth" || stage === "done")
  );

  function updateField<K extends keyof typeof form>(key: K, value: string) {
    setForm((current) => ({ ...current, [key]: value }));
  }

  function togglePlatform(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((p) => p !== id) : [...s, id]));
  }

  function onSubmitUrl(event: React.FormEvent) {
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
    setBrief(null);
    setStage("crawl");

    void (async () => {
      const begin = await beginAutoBriefRunAction({ productUrl: url });
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
      });

      let briefResult: Awaited<ReturnType<typeof executeAutoBriefRunAction>>;
      try {
        briefResult = await withTimeout(
          executeAutoBriefRunAction({
            projectId: begin.projectId,
            crawlId: begin.crawlId,
            productUrl: url,
            profile: "project",
          }),
          AUTOBRIEF_TIMEOUT_MS
        );
      } catch (err) {
        if (runIdRef.current !== runId) return;
        setError(err instanceof Error ? err.message : "AutoBrief timed out.");
        setIsBootstrapping(false);
        return;
      }

      if (runIdRef.current !== runId) return;

      if (!briefResult.ok) {
        setError(briefResult.error);
        setIsBootstrapping(false);
        toast.error(briefResult.error);
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
        setError(growthBegin.error);
        setIsBootstrapping(false);
        toast.error(growthBegin.error);
        onSuccess?.();
        router.push(`/projects/${begin.projectId}/brief`);
        return;
      }

      flushSync(() => {
        setGrowthRunId(growthBegin.growthRunId);
        setStage("growth");
      });

      startTransition(async () => {
        try {
          const growthResult = await withTimeout(
            executeOnboardingGrowthRunAction({
              projectId: begin.projectId,
              growthRunId: growthBegin.growthRunId,
            }),
            GROWTH_RUN_TIMEOUT_MS
          );

          if (!growthResult.ok) {
            setError(growthResult.error);
            toast.error(growthResult.error);
            onSuccess?.();
            router.push(
              growthResult.growthRunId
                ? `/projects/${begin.projectId}/growth/${growthResult.growthRunId}`
                : `/projects/${begin.projectId}/brief`
            );
            return;
          }

          toast.success("Project created — Growth Run ready for review.");
          onSuccess?.();
          router.push(`/projects/${begin.projectId}/growth/${growthResult.growthRunId}`);
          router.refresh();
        } finally {
          setIsBootstrapping(false);
        }
      });
    })();
  }

  function onSubmitManual(formData: FormData) {
    setError(null);
    formData.set("name", form.name);
    formData.set("product_url", form.product_url);
    formData.set("niche", form.niche);
    formData.set("description", form.description);
    formData.set("target_audience", form.target_audience);
    formData.set("offer", form.offer);
    formData.set("cta", form.cta);
    formData.set("competitors", form.competitors);
    for (const id of selected) formData.append("preferred_platforms", id);

    startTransition(async () => {
      const result = await createProjectAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Project created.");
      onSuccess?.();
      router.push(`/projects/${result.projectId}/brief`);
      router.refresh();
    });
  }

  if (mode === "url" && isBootstrapping) {
    return (
      <OnboardingPipelineShell
        stage={stage}
        autobriefProgress={autobriefProgress}
        growthProgress={growthProgress}
        brief={brief}
        title="Creating your project…"
        subtitle="Reading your website, saving your brief internally, and launching your first Growth Run."
      />
    );
  }

  if (mode === "url") {
    return (
      <form onSubmit={onSubmitUrl} className="space-y-6">
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
              disabled={pending || isBootstrapping}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your website — AutoScale reads it, saves your brief internally, and starts your Growth Run.
          </p>
        </div>

        {error && (
          <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
            {error}
          </div>
        )}

        <div className="flex flex-wrap items-center justify-between gap-2">
          <button
            type="button"
            className="text-xs text-muted-foreground underline-offset-4 hover:underline"
            onClick={() => setMode("manual")}
            disabled={pending || isBootstrapping}
          >
            Fill fields manually instead
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => (onSuccess ? onSuccess() : router.back())} disabled={pending || isBootstrapping}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || isBootstrapping || !productUrl.trim()} size="lg" variant="glow">
              {pending || isBootstrapping ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create from URL"}
            </Button>
          </div>
        </div>
      </form>
    );
  }

  return (
    <form action={onSubmitManual} className="space-y-6">
      <button
        type="button"
        className="text-xs text-muted-foreground underline-offset-4 hover:underline"
        onClick={() => setMode("url")}
        disabled={pending}
      >
        ← Back to URL-only setup
      </button>

      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Project name *</Label>
          <Input
            id="name"
            name="name"
            required
            value={form.name}
            onChange={(e) => updateField("name", e.target.value)}
            placeholder="Acme — Solo SaaS Growth"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="manual_product_url">Product URL</Label>
          <Input
            id="manual_product_url"
            name="product_url"
            type="url"
            value={form.product_url}
            onChange={(e) => updateField("product_url", e.target.value)}
            placeholder="https://acme.com"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="niche">Niche</Label>
          <Input id="niche" name="niche" value={form.niche} onChange={(e) => updateField("niche", e.target.value)} placeholder="B2C AI productivity app" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} value={form.description} onChange={(e) => updateField("description", e.target.value)} placeholder="What does your product do, in 1-2 sentences?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target_audience">Target audience</Label>
          <Input id="target_audience" name="target_audience" value={form.target_audience} onChange={(e) => updateField("target_audience", e.target.value)} placeholder="Solo SaaS founders post-launch" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offer">Offer</Label>
          <Input id="offer" name="offer" value={form.offer} onChange={(e) => updateField("offer", e.target.value)} placeholder="$149/month for the full growth loop" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cta">Preferred CTA</Label>
          <Input id="cta" name="cta" value={form.cta} onChange={(e) => updateField("cta", e.target.value)} placeholder="Run TrendWatch on your startup" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="competitors">Competitors (one per line)</Label>
          <Textarea id="competitors" name="competitors" rows={4} value={form.competitors} onChange={(e) => updateField("competitors", e.target.value)} placeholder={"Linear\nNotion\nBuffer"} />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label>Preferred platforms</Label>
          <div className="flex flex-wrap gap-2">
            {PLATFORMS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => togglePlatform(p.id)}
                className={cn(
                  "px-3 py-1.5 text-xs font-medium rounded-md border transition-all",
                  selected.includes(p.id)
                    ? "bg-primary/10 border-primary/40 text-primary"
                    : "border-border hover:border-foreground/20 text-foreground/70"
                )}
              >
                {p.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error && (
        <div className="rounded-md bg-destructive/10 border border-destructive/30 px-3 py-2 text-xs text-destructive">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => (onSuccess ? onSuccess() : router.back())}>
          Cancel
        </Button>
        <Button type="submit" disabled={pending} size="lg" variant="glow">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}
        </Button>
      </div>
    </form>
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
