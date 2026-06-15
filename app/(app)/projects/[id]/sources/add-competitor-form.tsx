"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus } from "lucide-react";
import { toast } from "sonner";
import { addCompetitorAction } from "./actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export function AddCompetitorForm({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onSubmit(formData: FormData) {
    formData.set("project_id", projectId);
    startTransition(async () => {
      const result = await addCompetitorAction(formData);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Competitor added.");
      const form = document.getElementById("competitor-form") as HTMLFormElement | null;
      form?.reset();
      router.refresh();
    });
  }

  return (
    <form id="competitor-form" action={onSubmit} className="space-y-3">
      <div className="space-y-1.5">
        <Label htmlFor="name">Name</Label>
        <Input id="name" name="name" required placeholder="Linear" />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="url">URL</Label>
        <Input id="url" name="url" type="url" placeholder="https://linear.app" />
      </div>
      <Button type="submit" disabled={pending} className="w-full" variant="outline">
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
        Add competitor
      </Button>
    </form>
  );
}
