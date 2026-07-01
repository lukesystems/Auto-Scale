"use client";

import { useTransition } from "react";
import { Loader2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { rerunStage3Action } from "@/app/(app)/projects/[id]/growth/actions";

export function Stage3RerunButton({
  projectId,
  growthRunId,
  variant = "outline",
  size = "sm",
  label = "Rerun Stage 3",
  className,
}: {
  projectId: string;
  growthRunId: string;
  variant?: "outline" | "ghost" | "default";
  size?: "sm" | "default";
  label?: string;
  className?: string;
}) {
  const [pending, startTransition] = useTransition();

  function onRerun() {
    if (!window.confirm("Rerun Stage 3 from scratch? Existing videos and approvals for this run will be cleared.")) {
      return;
    }
    startTransition(async () => {
      const result = await rerunStage3Action({ projectId, growthRunId });
      if (!result.ok) {
        toast.error(result.error ?? "Could not rerun Stage 3.");
        return;
      }
      toast.success("Stage 3 rerun started — rendering videos…");
      window.location.reload();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      className={className}
      onClick={onRerun}
      disabled={pending}
    >
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <RotateCcw className="h-4 w-4" />}
      {label}
    </Button>
  );
}
