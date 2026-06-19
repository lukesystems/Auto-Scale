"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { runPatternMiningAction } from "./actions";
import { Button } from "@/components/ui/button";

export function RunPatternMiningButton({
  projectId,
  disabled,
}: {
  projectId: string;
  disabled?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await runPatternMiningAction(projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(
        `Found ${result.patternCount ?? 0} market patterns across ${result.sourceCount ?? 0} sources.`
      );
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={pending || disabled} variant="glow">
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
      {pending ? "Mining patterns..." : "Run Pattern Mining"}
    </Button>
  );
}
