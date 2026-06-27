"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Brain, Loader2, Radar } from "lucide-react";
import { toast } from "sonner";
import { runDeepDiscoveryAction, runDiscoveryAction } from "./actions";
import { Button } from "@/components/ui/button";

export function DiscoverSourcesButton({
  projectId,
  briefComplete,
}: {
  projectId: string;
  briefComplete: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [deepPending, startDeepTransition] = useTransition();

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

  function onDeepResearch() {
    startDeepTransition(async () => {
      const toastId = toast.loading("Deep competitor research running — this can take a minute…");
      const result = await runDeepDiscoveryAction(projectId);
      if (!result.ok) {
        toast.error(result.error, { id: toastId });
        return;
      }
      toast.success(
        `Deep research done in ${result.rounds ?? 0} round(s). Saved ${result.candidatesSaved ?? 0} sources` +
          (result.competitorsPromoted
            ? ` and promoted ${result.competitorsPromoted} competitor profile(s).`
            : "."),
        { id: toastId }
      );
      router.refresh();
    });
  }

  const anyPending = pending || deepPending;

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="secondary"
        onClick={onDiscover}
        disabled={anyPending || !briefComplete}
        title={!briefComplete ? "Complete your Product Brief (summary, target customer, primary pain) first" : undefined}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Radar className="h-4 w-4" />}
        Discover sources
      </Button>
      <Button
        type="button"
        onClick={onDeepResearch}
        disabled={anyPending || !briefComplete}
        title={!briefComplete ? "Complete your Product Brief (summary, target customer, primary pain) first" : undefined}
      >
        {deepPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
        Deep research
      </Button>
    </div>
  );
}
