"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Save, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { aiGenerateBriefAction, saveBriefAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

interface BriefFormProps {
  projectId: string;
  initial: BriefFormState;
}

type BriefFormState = {
  source_url: string;
  product_name: string;
  one_line_description: string;
  category: string;
  product_type: string;
  product_summary: string;
  what_it_does: string;
  target_customer: string;
  target_audience: string;
  primary_pain: string;
  user_pain_points: string;
  core_promise: string;
  key_features: string;
  key_benefits: string;
  offer: string;
  cta: string;
  competitors: string;
  alternative_solutions: string;
  market_category: string;
  content_angles: string;
  platform_recommendations: string;
  cta_suggestions: string;
  founder_led_opportunities: string;
  positioning_gaps: string;
  extraction_notes: string;
  brand_voice: string;
  content_pillars: string;
  positioning_angles: string;
};

export function BriefForm({ projectId, initial }: BriefFormProps) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [generating, startGenerating] = useTransition();

  function update<K extends keyof BriefFormState>(key: K, value: string) {
    setState((s) => ({ ...s, [key]: value }));
  }

  function onSave(formData: FormData) {
    formData.set("project_id", projectId);
    startSaving(async () => {
      const result = await saveBriefAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Brief saved as project source of truth.");
      router.refresh();
    });
  }

  function onGenerate() {
    const fd = new FormData();
    fd.set("project_id", projectId);
    startGenerating(async () => {
      const result = await aiGenerateBriefAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setState((current) => ({
        ...current,
        product_summary: result.preview.product_summary,
        one_line_description: result.preview.product_summary,
        target_customer: result.preview.target_customer,
        primary_pain: result.preview.primary_pain,
        core_promise: result.preview.core_promise,
        offer: result.preview.offer,
        cta: result.preview.cta,
        brand_voice: result.preview.brand_voice,
        content_pillars: result.preview.content_pillars.join("\n"),
        positioning_angles: result.preview.positioning_angles.join("\n"),
        content_angles: result.preview.positioning_angles.join("\n"),
      }));
      toast.success("AI-generated brief saved. Refine as needed.");
      router.refresh();
    });
  }

  return (
    <form action={onSave} className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold tracking-tight">Loop 1 source of truth</h3>
          <p className="text-sm text-muted-foreground">
            This brief anchors TrendWatch, hooks, posts, experiments, and future weekly plans.
          </p>
        </div>
        <Button type="button" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating..." : "Regenerate with AI"}
        </Button>
      </div>

      <Section title="Product Summary">
        <div className="grid sm:grid-cols-2 gap-5">
          <Field label="Product name">
            <Input name="product_name" value={state.product_name} onChange={(e) => update("product_name", e.target.value)} />
          </Field>
          <Field label="Source URL">
            <Input name="source_url" value={state.source_url} onChange={(e) => update("source_url", e.target.value)} />
          </Field>
          <Field label="One-line description" className="sm:col-span-2">
            <Textarea name="one_line_description" rows={2} value={state.one_line_description} onChange={(e) => update("one_line_description", e.target.value)} />
          </Field>
          <Field label="Category / niche">
            <Input name="category" value={state.category} onChange={(e) => update("category", e.target.value)} />
          </Field>
          <Field label="Product type">
            <Input name="product_type" value={state.product_type} onChange={(e) => update("product_type", e.target.value)} />
          </Field>
          <Field label="What it does" className="sm:col-span-2">
            <Textarea name="what_it_does" rows={3} value={state.what_it_does} onChange={(e) => update("what_it_does", e.target.value)} />
          </Field>
          <input type="hidden" name="product_summary" value={state.one_line_description || state.product_summary} />
        </div>
      </Section>

      <Section title="Audience">
        <div className="grid gap-5">
          <Field label="Target customer">
            <Textarea name="target_customer" rows={2} value={state.target_customer} onChange={(e) => update("target_customer", e.target.value)} />
          </Field>
          <TextList label="Target audience guesses" name="target_audience" value={state.target_audience} onChange={(v) => update("target_audience", v)} />
          <TextList label="User pain points" name="user_pain_points" value={state.user_pain_points} onChange={(v) => update("user_pain_points", v)} />
        </div>
      </Section>

      <Section title="Problem + Promise">
        <div className="grid gap-5">
          <Field label="Primary pain">
            <Textarea name="primary_pain" rows={2} value={state.primary_pain} onChange={(e) => update("primary_pain", e.target.value)} />
          </Field>
          <Field label="Core promise">
            <Textarea name="core_promise" rows={2} value={state.core_promise} onChange={(e) => update("core_promise", e.target.value)} />
          </Field>
          <TextList label="Positioning gaps" name="positioning_gaps" value={state.positioning_gaps} onChange={(v) => update("positioning_gaps", v)} />
        </div>
      </Section>

      <Section title="Features + Benefits">
        <div className="grid sm:grid-cols-2 gap-5">
          <TextList label="Key features" name="key_features" value={state.key_features} onChange={(v) => update("key_features", v)} />
          <TextList label="Key benefits" name="key_benefits" value={state.key_benefits} onChange={(v) => update("key_benefits", v)} />
        </div>
      </Section>

      <Section title="Market + Competitors">
        <div className="grid gap-5">
          <Field label="Market category">
            <Input name="market_category" value={state.market_category} onChange={(e) => update("market_category", e.target.value)} />
          </Field>
          <TextList label="Likely competitors" name="competitors" value={state.competitors} onChange={(v) => update("competitors", v)} />
          <TextList label="Alternative solutions" name="alternative_solutions" value={state.alternative_solutions} onChange={(v) => update("alternative_solutions", v)} />
        </div>
      </Section>

      <Section title="Distribution Context">
        <div className="grid gap-5">
          <TextList label="Best content angles" name="content_angles" value={state.content_angles} onChange={(v) => update("content_angles", v)} />
          <TextList label="Content pillars" name="content_pillars" value={state.content_pillars} onChange={(v) => update("content_pillars", v)} />
          <TextList label="Platform recommendations" name="platform_recommendations" value={state.platform_recommendations} onChange={(v) => update("platform_recommendations", v)} hint="Use 'Platform: reason'." />
          <TextList label="CTA suggestions" name="cta_suggestions" value={state.cta_suggestions} onChange={(v) => update("cta_suggestions", v)} />
          <TextList label="Founder-led opportunities" name="founder_led_opportunities" value={state.founder_led_opportunities} onChange={(v) => update("founder_led_opportunities", v)} />
          <Field label="Preferred CTA">
            <Input name="cta" value={state.cta} onChange={(e) => update("cta", e.target.value)} />
          </Field>
          <Field label="Offer">
            <Input name="offer" value={state.offer} onChange={(e) => update("offer", e.target.value)} />
          </Field>
          <Field label="Brand voice">
            <Textarea name="brand_voice" rows={3} value={state.brand_voice} onChange={(e) => update("brand_voice", e.target.value)} />
          </Field>
          <input type="hidden" name="positioning_angles" value={state.positioning_angles || state.content_angles} />
        </div>
      </Section>

      <Section title="Confidence Notes">
        <TextList label="Extraction notes" name="extraction_notes" value={state.extraction_notes} onChange={(v) => update("extraction_notes", v)} />
      </Section>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" variant="default" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save brief"}
        </Button>
      </div>
    </form>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-border bg-card/70 p-5 space-y-5">
      <h3 className="font-semibold tracking-tight">{title}</h3>
      {children}
    </section>
  );
}

function TextList({
  label,
  name,
  value,
  hint,
  onChange,
}: {
  label: string;
  name: string;
  value: string;
  hint?: string;
  onChange: (value: string) => void;
}) {
  return (
    <Field label={label} hint={hint ?? "One per line."}>
      <Textarea name={name} rows={4} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function Field({
  label,
  hint,
  className,
  children,
}: {
  label: string;
  hint?: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <div className={`space-y-1.5 ${className ?? ""}`}>
      <Label>{label}</Label>
      {children}
      {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
    </div>
  );
}
