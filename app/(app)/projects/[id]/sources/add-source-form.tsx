"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addSourceAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";

const PLATFORMS = ["tiktok", "instagram", "x", "linkedin", "youtube", "threads", "pinterest", "reddit", "facebook", "other"];
const ACCOUNT_TYPES = ["official", "competitor", "shadow", "creator", "partner", "affiliate", "review", "unknown"];

export function AddSourceForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("project_id", projectId);
    startTransition(async () => {
      const result = await addSourceAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Source added.");
      const form = document.getElementById("source-form") as HTMLFormElement | null;
      form?.reset();
      router.refresh();
    });
  }

  return (
    <form id="source-form" action={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="source_url">URL</Label>
        <Input id="source_url" name="source_url" type="url" placeholder="https://tiktok.com/@founder/video/..." />
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="platform">Platform</Label>
          <select id="platform" name="platform" required className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
            {PLATFORMS.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="account_type">Account type</Label>
          <select id="account_type" name="account_type" className="h-10 w-full rounded-lg border border-input bg-background px-3 text-sm">
            {ACCOUNT_TYPES.map((p) => <option key={p} value={p}>{p}</option>)}
          </select>
        </div>
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account_handle">Handle (without @)</Label>
        <Input id="account_handle" name="account_handle" placeholder="founderName" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="caption">Caption or transcript</Label>
        <Textarea id="caption" name="caption" rows={3} placeholder="Paste the source caption or a short transcript." />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="published_at">Published date (optional)</Label>
        <Input id="published_at" name="published_at" type="date" />
      </div>
      <div className="grid grid-cols-2 gap-3">
        {["follower_count", "views", "likes", "saves", "shares", "comments"].map((field) => (
          <div key={field} className="space-y-1.5">
            <Label htmlFor={field}>{field.replace("_", " ")}</Label>
            <Input id={field} name={field} type="number" min={0} inputMode="numeric" />
          </div>
        ))}
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="screenshot">Screenshot (optional, max 5MB)</Label>
        <Input id="screenshot" name="screenshot" type="file" accept="image/png,image/jpeg,image/webp,image/gif" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="notes">Notes</Label>
        <Textarea id="notes" name="notes" rows={2} placeholder="Why is this worth analyzing?" />
      </div>
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add source
      </Button>
    </form>
  );
}
