"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Wand2 } from "lucide-react";
import { toast } from "sonner";
import { generatePostFromIdeaAction } from "../content/actions";
import { Button } from "@/components/ui/button";

export function GeneratePostButton({ projectId, ideaId }: { projectId: string; ideaId: string }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onClick() {
    const fd = new FormData();
    fd.set("project_id", projectId);
    fd.set("idea_id", ideaId);
    startTransition(async () => {
      const result = await generatePostFromIdeaAction(fd);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Post drafted.");
      router.push(`/projects/${projectId}/content`);
      router.refresh();
    });
  }

  return (
    <Button onClick={onClick} disabled={pending} variant="outline" size="sm">
      {pending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Wand2 className="h-3.5 w-3.5" />}
      {pending ? "Drafting..." : "Draft post"}
    </Button>
  );
}
