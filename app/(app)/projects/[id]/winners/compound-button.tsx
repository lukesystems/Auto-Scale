"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { compoundWinnerAction } from "./actions";
import { Button } from "@/components/ui/button";

export function CompoundButton({ projectId, experimentId }: { projectId: string; experimentId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("experiment_id", experimentId);
    startTransition(async () => {
      const result = await compoundWinnerAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Generated ${result.variantCount} variants and saved learnings.`);
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={pending} variant="glow" size="sm">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Compounding..." : "Compound this winner"}
    </Button>
  );
}
