"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { AlertTriangle, CheckCircle2, Globe, Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import type { ProviderMode } from "@/lib/provider-mode";
import type { AutoBrief } from "@/services/autobrief/schema";
import { LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import { confirmAutoBriefAction, fetchAndGenerateAutoBriefAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Step = "url" | "generating" | "review" | "error";
const GENERATION_TIMEOUT_MS = 240_000;

const GENERATION_STEPS = [
  {
    label: "Reading your website",
    detail: "Scanning pages and extracting product signals from your site.",
  },
  {
    label: "Understanding your product",
    detail: "Mapping features, audience, and positioning from what we found.",
  },
  {
    label: "Researching competitors & market",
    detail: "Identifying alternatives, category context, and positioning gaps.",
  },
  {
    label: "Planning your first video experiments",
    detail: "Exploring proven hooks, formats, platforms, and distribution opportunities.",
  },
  {
    label: "Building your growth brief",
    detail: "Structuring findings into an editable product brief.",
  },
] as const;

const PROGRESS_ADVANCE_MS = [0, 12_000, 35_000, 65_000, 100_000];

export function OnboardingWizard({ initialProviderMode }: { initialProviderMode: ProviderMode }) {
  const [step, setStep] = useState<Step>("url");
  const [providerMode] = useState<ProviderMode>(initialProviderMode);
  const [productUrl, setProductUrl] = useState("");
  const [projectId, setProjectId] = useState<string | null>(null);
  const [fetchFailed, setFetchFailed] = useState(false);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [brief, setBrief] = useState<AutoBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slowGenerationHint, setSlowGenerationHint] = useState(false);
  const [progressIndex, setProgressIndex] = useState(0);
  const [pending, startTransition] = useTransition();
  const generationIdRef = useRef(0);

  useEffect(() => {
    if (step !== "generating") {
      setSlowGenerationHint(false);
      setProgressIndex(0);
      return;
    }

    const slowTimer = setTimeout(() => setSlowGenerationHint(true), 90_000);
    const advanceTimers = PROGRESS_ADVANCE_MS.map((delay, index) =>
      setTimeout(() => setProgressIndex(index), delay)
    );

    return () => {
      clearTimeout(slowTimer);
      advanceTimers.forEach(clearTimeout);
    };
  }, [step]);

  function onGenerate() {
    if (!productUrl.trim()) {
      toast.error("Paste your product URL first.");
      return;
    }

    const generationId = generationIdRef.current + 1;
    generationIdRef.current = generationId;
    setStep("generating");
    setErrorMessage(null);
    startTransition(async () => {
      let result: Awaited<ReturnType<typeof fetchAndGenerateAutoBriefAction>>;
      try {
        result = await withTimeout(
          fetchAndGenerateAutoBriefAction({ productUrl }),
          GENERATION_TIMEOUT_MS
        );
      } catch (err) {
        if (generationIdRef.current !== generationId) return;
        setErrorMessage(err instanceof Error ? err.message : "AutoBrief generation timed out.");
        setStep("error");
        return;
      }

      if (generationIdRef.current !== generationId) return;

      if (!result) {
        setErrorMessage(
          "AutoBrief generation failed unexpectedly. Try again or check /debug/ai-runs for details."
        );
        setStep("error");
        return;
      }

      if (!result.ok || !result.brief) {
        if (!result.ok && result.projectId) setProjectId(result.projectId);
        setErrorMessage(result.ok ? "Generation failed." : result.error);
        setStep("error");
        return;
      }

      setProjectId(result.projectId ?? null);
      setBrief(result.brief);
      setFetchFailed(Boolean(result.fetchFailed));
      setLowConfidence(Boolean(result.lowConfidence));
      setStep("review");
    });
  }

  function onConfirm() {
    if (!brief) return;
    if (!projectId) {
      toast.error("Project was not created. Generate the brief again.");
      return;
    }

    startTransition(async () => {
      const result = await confirmAutoBriefAction({ projectId, brief, providerMode });
      if (!result) {
        toast.error("Failed to save product brief. Try again.");
        return;
      }
      if (!result.ok) toast.error(result.error);
    });
  }

  function returnToUrl() {
    generationIdRef.current += 1;
    setStep("url");
  }

  function updateBrief(patch: Partial<AutoBrief>) {
    if (!brief) return;
    setBrief({ ...brief, ...patch });
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
              if (e.key === "Enter" && !pending) onGenerate();
            }}
          />
          <p className="text-xs text-muted-foreground">
            AutoScale will study your product, find the video formats worth scaling in your niche, and create your first short-form video Growth Run.
          </p>
        </div>

        <div className="flex justify-end pt-2">
          <Button type="button" disabled={pending} onClick={onGenerate}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
            Start Growth Run
          </Button>
        </div>
      </div>
    );
  }

  if (step === "generating") {
    return (
      <div className="py-8 space-y-6">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-primary/10">
            <Globe className="h-6 w-6 text-primary animate-pulse" />
          </div>
          <p className="font-medium text-lg">Analyzing your product...</p>
          <p className="text-sm text-muted-foreground max-w-md mx-auto">
            AutoScale is reading your site, mapping your niche, and planning trend-backed video experiments in real time.
          </p>
        </div>

        <ol className="space-y-3 max-w-lg mx-auto">
          {GENERATION_STEPS.map((item, index) => {
            const isComplete = index < progressIndex;
            const isActive = index === progressIndex;
            const isPending = index > progressIndex;

            return (
              <li
                key={item.label}
                className={cn(
                  "rounded-lg border p-4 transition-all duration-500",
                  isActive && "border-primary/40 bg-primary/5 shadow-sm",
                  isComplete && "border-border/60 bg-background/40",
                  isPending && "border-border/40 bg-background/20 opacity-60"
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="mt-0.5 shrink-0">
                    {isComplete ? (
                      <CheckCircle2 className="h-5 w-5 text-primary" />
                    ) : isActive ? (
                      <Loader2 className="h-5 w-5 animate-spin text-primary" />
                    ) : (
                      <div className="h-5 w-5 rounded-full border-2 border-muted-foreground/30" />
                    )}
                  </div>
                  <div className="min-w-0 text-left">
                    <p className={cn("text-sm font-medium", isActive && "text-foreground")}>{item.label}</p>
                    {(isActive || isComplete) && (
                      <p className="mt-1 text-xs text-muted-foreground leading-relaxed">{item.detail}</p>
                    )}
                  </div>
                </div>
              </li>
            );
          })}
        </ol>

        <p className="text-center text-sm text-muted-foreground">
          This usually takes 30–90 seconds depending on the model and website. Reasoning models may take longer.
        </p>
        {slowGenerationHint && (
          <p className="text-center text-sm text-amber-600 dark:text-amber-500 max-w-sm mx-auto">
            Still working — reasoning models like DeepSeek V4 Pro think deeply before responding. This can take 1–3 minutes.
          </p>
        )}
      </div>
    );
  }

  if (step === "error") {
    return (
      <div className="space-y-4">
        <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-4 text-sm">
          <p className="font-medium text-destructive">Something went wrong</p>
          <p className="mt-1 text-muted-foreground">{errorMessage}</p>
        </div>
        <div className="flex gap-2 flex-wrap">
          <Button type="button" onClick={returnToUrl}>
            Try again
          </Button>
        </div>
      </div>
    );
  }

  if (step === "review" && brief) {
    return (
      <div className="space-y-5">
        {(fetchFailed || lowConfidence) && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm flex gap-3">
            <AlertTriangle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
            <div>
              <p className="font-medium">Review before saving</p>
              <p className="mt-1 text-muted-foreground">
                {fetchFailed
                  ? "The website was hard to read. Verify the details below before this becomes project memory."
                  : "Confidence is low. Fill obvious gaps before creating the project."}
              </p>
              {brief.missing_information.length > 0 && (
                <ul className="mt-2 list-disc pl-4 text-muted-foreground">
                  {brief.missing_information.map((item) => (
                    <li key={item}>{item}</li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        )}

        <div className="flex items-center gap-2">
          <Badge variant={brief.confidence_score >= LOW_CONFIDENCE_THRESHOLD ? "success" : "secondary"}>
            Confidence {Math.round(brief.confidence_score * 100)}%
          </Badge>
          <Badge variant="outline">Source-of-truth draft</Badge>
        </div>

        <Section title="Product Summary" confidence={brief.confidence.features}>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Product name" value={brief.product_name} onChange={(v) => updateBrief({ product_name: v })} />
            <Field label="Website URL" value={brief.product_url} onChange={(v) => updateBrief({ product_url: v })} />
            <Field
              label="One-line description"
              value={brief.one_line_description || brief.product_summary}
              onChange={(v) => updateBrief({ one_line_description: v, product_summary: v })}
              multiline
              className="sm:col-span-2"
            />
            <Field label="Category / niche" value={brief.category || brief.niche} onChange={(v) => updateBrief({ category: v, niche: v })} />
            <Field label="Product type" value={brief.product_type} onChange={(v) => updateBrief({ product_type: v })} />
            <Field
              label="What it does"
              value={brief.what_it_does || brief.product_summary}
              onChange={(v) => updateBrief({ what_it_does: v })}
              multiline
              className="sm:col-span-2"
            />
          </div>
        </Section>

        <Section title="Audience" confidence={brief.confidence.audience}>
          <div className="grid gap-4">
            <Field label="Target customer" value={brief.target_customer} onChange={(v) => updateBrief({ target_customer: v })} multiline />
            <ArrayField label="Target audience guesses" value={brief.target_audience} onChange={(v) => updateBrief({ target_audience: v })} />
            <ArrayField
              label="User pain points"
              value={brief.user_pain_points.length ? brief.user_pain_points : [brief.primary_pain].filter(Boolean)}
              onChange={(v) => updateBrief({ user_pain_points: v, primary_pain: v[0] ?? "" })}
            />
          </div>
        </Section>

        <Section title="Problem + Promise" confidence={brief.confidence.positioning}>
          <div className="grid gap-4">
            <Field label="Primary pain" value={brief.primary_pain} onChange={(v) => updateBrief({ primary_pain: v })} multiline />
            <Field label="Core promise" value={brief.core_promise} onChange={(v) => updateBrief({ core_promise: v })} multiline />
            <ArrayField label="Positioning gaps" value={brief.positioning_gaps} onChange={(v) => updateBrief({ positioning_gaps: v })} />
          </div>
        </Section>

        <Section title="Features + Benefits" confidence={brief.confidence.features}>
          <div className="grid gap-4 sm:grid-cols-2">
            <ArrayField label="Key features" value={brief.key_features} onChange={(v) => updateBrief({ key_features: v })} />
            <ArrayField label="Key benefits" value={brief.key_benefits} onChange={(v) => updateBrief({ key_benefits: v })} />
          </div>
        </Section>

        <Section title="Market + Competitors" confidence={brief.confidence.competitors}>
          <div className="grid gap-4">
            <Field label="Market category" value={brief.market_category} onChange={(v) => updateBrief({ market_category: v })} />
            <ArrayField
              label="Likely competitors"
              value={brief.suggested_competitors.map((c) => c.name)}
              onChange={(v) => updateBrief({ suggested_competitors: v.map((name) => ({ name, reason: "Founder edited guess", confidence: "low" })) })}
            />
            <ArrayField label="Alternative solutions users already use" value={brief.alternative_solutions} onChange={(v) => updateBrief({ alternative_solutions: v })} />
          </div>
        </Section>

        <Section title="Distribution Context" confidence={brief.confidence.positioning}>
          <div className="grid gap-4">
            <ArrayField
              label="Best content angles"
              value={brief.content_angles.length ? brief.content_angles : brief.positioning_angles}
              onChange={(v) => updateBrief({ content_angles: v, positioning_angles: v })}
            />
            <ArrayField label="Content pillars" value={brief.content_pillars} onChange={(v) => updateBrief({ content_pillars: v })} />
            <ArrayField
              label="Likely winning platforms"
              value={brief.platform_recommendations.map((p) => `${p.platform}: ${p.reason}`)}
              onChange={(v) => updateBrief({ platform_recommendations: v.map(parsePlatformRecommendation) })}
            />
            <ArrayField
              label="CTA suggestions"
              value={brief.cta_suggestions.length ? brief.cta_suggestions : [brief.cta ?? ""].filter(Boolean)}
              onChange={(v) => updateBrief({ cta_suggestions: v, cta: v[0] ?? "" })}
            />
            <ArrayField label="Founder-led content opportunities" value={brief.founder_led_opportunities} onChange={(v) => updateBrief({ founder_led_opportunities: v })} />
            <Field label="Brand voice / tone" value={brief.brand_voice ?? ""} onChange={(v) => updateBrief({ brand_voice: v })} multiline />
          </div>
        </Section>

        <Section title="Confidence Notes" confidence={brief.confidence.overall}>
          <ArrayField
            label="Extraction notes"
            value={brief.extraction_notes.length ? brief.extraction_notes : brief.missing_information}
            onChange={(v) => updateBrief({ extraction_notes: v })}
          />
        </Section>

        <div className="flex justify-between pt-2 gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={returnToUrl}>
            Back
          </Button>
          <div className="flex gap-2">
            <Button type="button" variant="secondary" disabled={pending} onClick={onGenerate}>
              Regenerate
            </Button>
            <Button type="button" disabled={pending} onClick={onConfirm}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Save Brief
            </Button>
          </div>
        </div>
      </div>
    );
  }

  return null;
}

function Field({
  label,
  value,
  onChange,
  multiline,
  className,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1.5", className)}>
      <Label>{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}

function ArrayField({ label, value, onChange }: { label: string; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      <Textarea value={value.join("\n")} onChange={(e) => onChange(lines(e.target.value))} rows={4} />
      <p className="text-xs text-muted-foreground">One per line.</p>
    </div>
  );
}

function Section({
  title,
  confidence,
  children,
}: {
  title: string;
  confidence: "low" | "medium" | "high";
  children: React.ReactNode;
}) {
  return (
    <section className="rounded-xl border border-border bg-background/60 p-5 space-y-4">
      <div className="flex items-center justify-between gap-3">
        <h3 className="font-semibold">{title}</h3>
        <Badge variant={confidence === "high" ? "success" : confidence === "low" ? "warning" : "secondary"}>
          {confidence} confidence
        </Badge>
      </div>
      {children}
    </section>
  );
}

function lines(value: string): string[] {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

function parsePlatformRecommendation(value: string): { platform: string; reason: string } {
  const [platform, ...reason] = value.split(":");
  return {
    platform: platform?.trim() || "unknown",
    reason: reason.join(":").trim() || "Founder edited recommendation",
  };
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `AutoBrief generation timed out after ${Math.round(timeoutMs / 1000)} seconds. Reasoning models (e.g. DeepSeek V4 Pro) may need more time. Try again or switch to a faster model like deepseek/deepseek-v4-flash.`
        )
      );
    }, timeoutMs);
  });

  try {
    return await Promise.race([promise, timeout]);
  } finally {
    if (timer) clearTimeout(timer);
  }
}
