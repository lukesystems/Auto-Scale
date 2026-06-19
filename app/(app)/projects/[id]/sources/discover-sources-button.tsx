"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Radar } from "lucide-react";
import { toast } from "sonner";
import { runDiscoveryAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DiscoverSourcesButton({
  projectId,
  hasBrief,
}: {
  projectId: string;
  hasBrief: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onDiscover() {
    startTransition(async () => {
      const result = await runDiscoveryAction(projectId);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(`Found ${result.candidatesSaved ?? 0} source candidates. Review below.`);
      router.refresh();
    });
  }

  return (
    <Button type="button" variant="secondary" onClick={onDiscover} disabled={pending || !hasBrief}>
      {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
      Discover sources
    </Button>
  );
}
