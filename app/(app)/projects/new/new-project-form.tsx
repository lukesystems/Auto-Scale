"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Globe, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProjectAction, createProjectFromUrlAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";

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

    setError(null);

    startTransition(async () => {
      const result = await createProjectFromUrlAction(url);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      if (result.fetchWarning) {
        toast.warning(result.fetchWarning);
      } else {
        toast.success("Project created from your website.");
      }
      onSuccess?.();
      router.push(`/projects/${result.projectId}/brief`);
      router.refresh();
    });
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
              disabled={pending}
            />
          </div>
          <p className="text-xs text-muted-foreground">
            Paste your website — AutoScale reads it and builds your product brief automatically.
          </p>
        </div>

        {pending && (
          <div className="flex items-center gap-2 rounded-md border border-border bg-secondary/40 px-3 py-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Reading your website and generating your product brief…
          </div>
        )}

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
            disabled={pending}
          >
            Fill fields manually instead
          </button>
          <div className="flex gap-2">
            <Button type="button" variant="outline" onClick={() => (onSuccess ? onSuccess() : router.back())} disabled={pending}>
              Cancel
            </Button>
            <Button type="submit" disabled={pending || !productUrl.trim()} size="lg" variant="glow">
              {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create from URL"}
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
          <Input
            id="niche"
            name="niche"
            value={form.niche}
            onChange={(e) => updateField("niche", e.target.value)}
            placeholder="B2C AI productivity app"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea
            id="description"
            name="description"
            rows={3}
            value={form.description}
            onChange={(e) => updateField("description", e.target.value)}
            placeholder="What does your product do, in 1-2 sentences?"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target_audience">Target audience</Label>
          <Input
            id="target_audience"
            name="target_audience"
            value={form.target_audience}
            onChange={(e) => updateField("target_audience", e.target.value)}
            placeholder="Solo SaaS founders post-launch"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offer">Offer</Label>
          <Input
            id="offer"
            name="offer"
            value={form.offer}
            onChange={(e) => updateField("offer", e.target.value)}
            placeholder="$149/month for the full growth loop"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cta">Preferred CTA</Label>
          <Input
            id="cta"
            name="cta"
            value={form.cta}
            onChange={(e) => updateField("cta", e.target.value)}
            placeholder="Run TrendWatch on your startup"
          />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="competitors">Competitors (one per line)</Label>
          <Textarea
            id="competitors"
            name="competitors"
            rows={4}
            value={form.competitors}
            onChange={(e) => updateField("competitors", e.target.value)}
            placeholder={"Linear\nNotion\nBuffer"}
          />
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
