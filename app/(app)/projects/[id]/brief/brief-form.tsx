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
  initial: {
    product_summary: string;
    target_customer: string;
    primary_pain: string;
    core_promise: string;
    offer: string;
    cta: string;
    brand_voice: string;
    content_pillars: string;
    positioning_angles: string;
  };
}

export function BriefForm({ projectId, initial }: BriefFormProps) {
  const router = useRouter();
  const [state, setState] = useState(initial);
  const [saving, startSaving] = useTransition();
  const [generating, startGenerating] = useTransition();

  function update<K extends keyof typeof initial>(key: K, value: string) {
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
      toast.success("Brief saved.");
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
      setState({
        product_summary: result.preview.product_summary,
        target_customer: result.preview.target_customer,
        primary_pain: result.preview.primary_pain,
        core_promise: result.preview.core_promise,
        offer: result.preview.offer,
        cta: result.preview.cta,
        brand_voice: result.preview.brand_voice,
        content_pillars: result.preview.content_pillars.join("\n"),
        positioning_angles: result.preview.positioning_angles.join("\n"),
      });
      toast.success("AI-generated brief saved. Refine as needed.");
      router.refresh();
    });
  }

  return (
    <form action={onSave} className="space-y-6">
      <div className="rounded-xl border border-primary/20 bg-primary/[0.04] p-5 flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h3 className="font-semibold tracking-tight">Need a head start?</h3>
          <p className="text-sm text-muted-foreground">Let AutoScale draft your brief from the project details. You can refine after.</p>
        </div>
        <Button type="button" onClick={onGenerate} disabled={generating}>
          {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
          {generating ? "Generating..." : "Generate with AI"}
        </Button>
      </div>

      <div className="grid sm:grid-cols-2 gap-5">
        <Field label="Product summary" hint="One sentence describing what you do." className="sm:col-span-2">
          <Textarea name="product_summary" rows={2} value={state.product_summary} onChange={(e) => update("product_summary", e.target.value)} />
        </Field>

        <Field label="Target customer" hint="Specific ICP. Not 'everyone'.">
          <Input name="target_customer" value={state.target_customer} onChange={(e) => update("target_customer", e.target.value)} />
        </Field>

        <Field label="Primary pain" hint="The acute pain you solve.">
          <Input name="primary_pain" value={state.primary_pain} onChange={(e) => update("primary_pain", e.target.value)} />
        </Field>

        <Field label="Core promise" hint="The transformation in one line.">
          <Input name="core_promise" value={state.core_promise} onChange={(e) => update("core_promise", e.target.value)} />
        </Field>

        <Field label="Offer" hint="What they get + price.">
          <Input name="offer" value={state.offer} onChange={(e) => update("offer", e.target.value)} />
        </Field>

        <Field label="CTA" hint="Short and actionable.">
          <Input name="cta" value={state.cta} onChange={(e) => update("cta", e.target.value)} />
        </Field>

        <Field label="Brand voice" hint="One paragraph describing how you sound." className="sm:col-span-2">
          <Textarea name="brand_voice" rows={3} value={state.brand_voice} onChange={(e) => update("brand_voice", e.target.value)} />
        </Field>

        <Field label="Content pillars" hint="One per line. 3-6 themes." className="sm:col-span-2">
          <Textarea name="content_pillars" rows={4} value={state.content_pillars} onChange={(e) => update("content_pillars", e.target.value)} />
        </Field>

        <Field label="Positioning angles" hint="One per line. 3-5 angles." className="sm:col-span-2">
          <Textarea name="positioning_angles" rows={4} value={state.positioning_angles} onChange={(e) => update("positioning_angles", e.target.value)} />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <Button type="submit" size="lg" variant="default" disabled={saving}>
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
          {saving ? "Saving..." : "Save brief"}
        </Button>
      </div>
    </form>
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
