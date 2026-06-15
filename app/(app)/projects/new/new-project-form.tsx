"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { createProjectAction } from "./actions";
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

export function NewProjectForm() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<string[]>(["linkedin", "x"]);

  function togglePlatform(id: string) {
    setSelected((s) => (s.includes(id) ? s.filter((p) => p !== id) : [...s, id]));
  }

  function onSubmit(formData: FormData) {
    setError(null);
    for (const id of selected) formData.append("preferred_platforms", id);

    startTransition(async () => {
      const result = await createProjectAction(formData);
      if (!result.ok) {
        setError(result.error);
        toast.error(result.error);
        return;
      }
      toast.success("Project created.");
      router.push(`/projects/${result.projectId}/brief`);
      router.refresh();
    });
  }

  return (
    <form action={onSubmit} className="space-y-6">
      <div className="grid sm:grid-cols-2 gap-5">
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="name">Project name *</Label>
          <Input id="name" name="name" required placeholder="Acme — Solo SaaS Growth" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="product_url">Product URL</Label>
          <Input id="product_url" name="product_url" type="url" placeholder="https://acme.com" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="niche">Niche</Label>
          <Input id="niche" name="niche" placeholder="B2C AI productivity app" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="description">Description</Label>
          <Textarea id="description" name="description" rows={3} placeholder="What does your product do, in 1-2 sentences?" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="target_audience">Target audience</Label>
          <Input id="target_audience" name="target_audience" placeholder="Solo SaaS founders post-launch" />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="offer">Offer</Label>
          <Input id="offer" name="offer" placeholder="$149/month for the full growth loop" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="cta">Preferred CTA</Label>
          <Input id="cta" name="cta" placeholder="Run TrendWatch on your startup" />
        </div>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="competitors">Competitors (one per line)</Label>
          <Textarea id="competitors" name="competitors" rows={4} placeholder={"Linear\nNotion\nBuffer"} />
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
        <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
        <Button type="submit" disabled={pending} size="lg" variant="glow">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : "Create project"}
        </Button>
      </div>
    </form>
  );
}
