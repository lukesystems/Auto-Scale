"use client";

import { useEffect, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, Globe, Loader2, Sparkles, Wrench } from "lucide-react";
import { toast } from "sonner";
import type { ProviderMode } from "@/lib/provider-mode";
import type { AutoBrief } from "@/services/autobrief/schema";
import { LOW_CONFIDENCE_THRESHOLD } from "@/services/autobrief/schema";
import {
  confirmAutoBriefAction,
  fetchAndGenerateAutoBriefAction,
  saveProviderModeAction,
  skipOnboardingAction,
} from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Step = "mode" | "url" | "generating" | "review" | "error";

export function OnboardingWizard({ initialProviderMode }: { initialProviderMode: ProviderMode }) {
  const [step, setStep] = useState<Step>("mode");
  const [providerMode, setProviderMode] = useState<ProviderMode>(initialProviderMode);
  const [productUrl, setProductUrl] = useState("");
  const [manualName, setManualName] = useState("");
  const [manualDescription, setManualDescription] = useState("");
  const [fetchFailed, setFetchFailed] = useState(false);
  const [lowConfidence, setLowConfidence] = useState(false);
  const [brief, setBrief] = useState<AutoBrief | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [slowGenerationHint, setSlowGenerationHint] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (step !== "generating") {
      setSlowGenerationHint(false);
      return;
    }

    const timer = setTimeout(() => setSlowGenerationHint(true), 45_000);
    return () => clearTimeout(timer);
  }, [step]);

  function selectMode(mode: ProviderMode) {
    setProviderMode(mode);
    startTransition(async () => {
      const result = await saveProviderModeAction(mode);
      if (!result.ok) toast.error(result.error);
    });
  }

  function onContinueFromMode() {
    setStep("url");
  }

  function onGenerate(skipFetch = false) {
    if (!productUrl.trim() && !manualName.trim()) {
      toast.error("Enter a website URL or product name.");
      return;
    }
    setStep("generating");
    setErrorMessage(null);
    startTransition(async () => {
      const result = await fetchAndGenerateAutoBriefAction({
        productUrl: productUrl || "https://example.com",
        manualProductName: manualName || undefined,
        manualDescription: manualDescription || undefined,
        skipFetch,
      });
      if (!result.ok || !result.brief) {
        setErrorMessage(result.ok ? "Generation failed." : result.error);
        setStep("error");
        return;
      }
      setBrief(result.brief);
      setFetchFailed(Boolean(result.fetchFailed));
      setLowConfidence(Boolean(result.lowConfidence));
      setStep("review");
    });
  }

  function onConfirm() {
    if (!brief) return;
    if (lowConfidence && brief.confidence_score < LOW_CONFIDENCE_THRESHOLD) {
      toast.error("Please review and improve the brief before continuing — confidence is low.");
      return;
    }
    startTransition(async () => {
      const result = await confirmAutoBriefAction({ brief, providerMode });
      if (!result.ok) toast.error(result.error);
    });
  }

  function updateBrief(patch: Partial<AutoBrief>) {
    if (!brief) return;
    setBrief({ ...brief, ...patch });
  }

  if (step === "mode") {
    return (
      <div className="space-y-6">
        <p className="text-sm text-muted-foreground">How should AutoScale connect to AI and scheduling providers?</p>
        <div className="grid gap-4 sm:grid-cols-2">
          <ModeCard
            selected={providerMode === "managed"}
            title="Managed Mode"
            recommended
            icon={<Sparkles className="h-5 w-5 text-primary" />}
            description="AutoScale handles the technical setup. You do not need API keys."
            onSelect={() => selectMode("managed")}
          />
          <ModeCard
            selected={providerMode === "byok"}
            title="Advanced Mode"
            icon={<Wrench className="h-5 w-5 text-muted-foreground" />}
            description="Bring your own OpenRouter, Postiz, or media provider keys. Recommended only for technical users."
            onSelect={() => selectMode("byok")}
          />
        </div>
        <div className="flex justify-between pt-2">
          <Button type="button" variant="ghost" onClick={() => startTransition(() => skipOnboardingAction())}>
            Skip for now
          </Button>
          <Button type="button" onClick={onContinueFromMode}>
            Continue <ArrowRight className="h-4 w-4" />
          </Button>
        </div>
      </div>
    );
  }

  if (step === "url") {
    return (
      <div className="space-y-5">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Globe className="h-4 w-4" />
          Paste your startup or product website. AutoScale will extract context and generate your brief.
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product_url">Website URL</Label>
          <Input
            id="product_url"
            value={productUrl}
            onChange={(e) => setProductUrl(e.target.value)}
            placeholder="https://yourproduct.com"
          />
        </div>
        {fetchFailed && (
          <div className="rounded-lg border border-amber-500/30 bg-amber-500/5 p-4 text-sm">
            <p className="font-medium text-foreground">Could not fetch website</p>
            <p className="mt-1 text-muted-foreground">Add manual details below or try again.</p>
          </div>
        )}
        <div className="space-y-1.5">
          <Label htmlFor="manual_name">Product name (fallback)</Label>
          <Input id="manual_name" value={manualName} onChange={(e) => setManualName(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="manual_description">Description (fallback)</Label>
          <Textarea
            id="manual_description"
            value={manualDescription}
            onChange={(e) => setManualDescription(e.target.value)}
            rows={3}
          />
        </div>
        <div className="flex justify-between pt-2 gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={() => setStep("mode")}>
            Back
          </Button>
          <div className="flex gap-2">
            {fetchFailed && (
              <Button type="button" variant="secondary" disabled={pending} onClick={() => onGenerate(true)}>
                Use manual entry
              </Button>
            )}
            <Button type="button" disabled={pending} onClick={() => onGenerate(false)}>
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
              Generate AutoBrief
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (step === "generating") {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center space-y-4">
        <Loader2 className="h-10 w-10 animate-spin text-primary" />
        <p className="font-medium">Generating your product brief…</p>
        <p className="text-sm text-muted-foreground max-w-sm">
          Fetching your site safely, then drafting positioning, pillars, and competitor suggestions.
        </p>
        <p className="text-sm text-muted-foreground max-w-sm">
          This can take 20–60 seconds depending on the model.
        </p>
        {slowGenerationHint && (
          <p className="text-sm text-amber-600 dark:text-amber-500 max-w-sm">
            Still working? Use manual entry or try a faster model.
          </p>
        )}
        <Button type="button" variant="outline" onClick={() => setStep("url")}>
          Use manual entry
        </Button>
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
          <Button type="button" onClick={() => setStep("url")}>
            Try again
          </Button>
          <Button type="button" variant="secondary" onClick={() => setStep("url")}>
            Use manual entry
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
              <p className="font-medium">Review before continuing</p>
              <p className="mt-1 text-muted-foreground">
                {fetchFailed
                  ? "We could not fetch your website — verify the details below."
                  : "Confidence is low — fill gaps in missing information before creating your project."}
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
          <Badge variant="outline">{providerMode === "managed" ? "Managed Mode" : "Advanced Mode"}</Badge>
        </div>

        <div className="grid gap-4">
          <Field label="Product name" value={brief.product_name} onChange={(v) => updateBrief({ product_name: v })} />
          <Field label="Summary" value={brief.product_summary} onChange={(v) => updateBrief({ product_summary: v })} multiline />
          <Field label="Target customer" value={brief.target_customer} onChange={(v) => updateBrief({ target_customer: v })} multiline />
          <Field label="Primary pain" value={brief.primary_pain} onChange={(v) => updateBrief({ primary_pain: v })} multiline />
          <Field label="Core promise" value={brief.core_promise} onChange={(v) => updateBrief({ core_promise: v })} multiline />
          <Field label="Niche" value={brief.niche} onChange={(v) => updateBrief({ niche: v })} />
        </div>

        {brief.suggested_competitors.length > 0 && (
          <div>
            <p className="text-sm font-medium mb-2">Suggested competitors</p>
            <ul className="text-sm text-muted-foreground space-y-1">
              {brief.suggested_competitors.map((c) => (
                <li key={c.name}>
                  {c.name}
                  {c.url ? ` (${c.url})` : ""} — {c.reason}
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="flex justify-between pt-2 gap-2 flex-wrap">
          <Button type="button" variant="outline" onClick={() => setStep("url")}>
            Back
          </Button>
          <Button type="button" disabled={pending} onClick={onConfirm}>
            {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create project
          </Button>
        </div>
      </div>
    );
  }

  return null;
}

function ModeCard({
  selected,
  title,
  description,
  recommended,
  icon,
  onSelect,
}: {
  selected: boolean;
  title: string;
  description: string;
  recommended?: boolean;
  icon: React.ReactNode;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={cn(
        "rounded-xl border p-5 text-left transition-all hover:border-primary/40",
        selected ? "border-primary bg-primary/5 ring-1 ring-primary/20" : "border-border bg-background"
      )}
    >
      <div className="flex items-start justify-between gap-2">
        {icon}
        {recommended && <Badge variant="success">Recommended</Badge>}
      </div>
      <h3 className="mt-3 font-semibold">{title}</h3>
      <p className="mt-2 text-sm text-muted-foreground">{description}</p>
    </button>
  );
}

function Field({
  label,
  value,
  onChange,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <Label>{label}</Label>
      {multiline ? (
        <Textarea value={value} onChange={(e) => onChange(e.target.value)} rows={2} />
      ) : (
        <Input value={value} onChange={(e) => onChange(e.target.value)} />
      )}
    </div>
  );
}
