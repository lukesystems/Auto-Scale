"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Trash2 } from "lucide-react";
import { toast } from "sonner";
import { deleteSourceAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DeleteSourceButton({ projectId, sourceId }: { projectId: string; sourceId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("source_id", sourceId);
    startTransition(async () => {
      const result = await deleteSourceAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Source removed.");
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="ghost" size="icon" onClick={onClick} disabled={pending} aria-label="Remove source">
      <Trash2 className="h-4 w-4 text-muted-foreground hover:text-destructive" />
    </Button>
  );
}
