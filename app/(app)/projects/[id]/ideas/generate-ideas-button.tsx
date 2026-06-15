"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { generateIdeasAction } from "./actions";
import { Button } from "@/components/ui/button";

export function GenerateIdeasButton({ projectId, hasHooks }: { projectId: string; hasHooks: boolean }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("project_id", projectId);
    startTransition(async () => {
      const result = await generateIdeasAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Generated ${result.hookCount} hooks and ${result.ideaCount} ideas.`);
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={pending} variant="glow">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Generating..." : hasHooks ? "Generate more ideas" : "Generate hooks & ideas"}
    </Button>
  );
}
