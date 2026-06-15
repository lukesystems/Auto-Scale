"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { runTrendWatchAction } from "./actions";
import { Button } from "@/components/ui/button";

export function RunTrendWatchButton({ projectId }: { projectId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("project_id", projectId);
    startTransition(async () => {
      const result = await runTrendWatchAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`TrendWatch complete — ${result.insightCount} insights.`);
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={pending} variant="glow">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
      {pending ? "Running TrendWatch..." : "Run TrendWatch"}
    </Button>
  );
}
