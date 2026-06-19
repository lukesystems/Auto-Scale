"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, X } from "lucide-react";
import { toast } from "sonner";
import { acceptCandidateAction, rejectCandidateAction } from "./actions";
import { Button } from "@/components/ui/button";

export function CandidateReviewButtons({
  projectId,
  candidateId,
}: {
  projectId: string;
  candidateId: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function onAccept() {
    startTransition(async () => {
      const result = await acceptCandidateAction({ projectId, candidateId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Candidate added to TrendWatch sources.");
      router.refresh();
    });
  }

  function onReject() {
    startTransition(async () => {
      const result = await rejectCandidateAction({ projectId, candidateId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Candidate dismissed.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-2">
      <Button type="button" size="sm" onClick={onAccept} disabled={pending}>
        {pending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
        Accept
      </Button>
      <Button type="button" size="sm" variant="outline" onClick={onReject} disabled={pending}>
        <X className="h-3 w-3" />
        Reject
      </Button>
    </div>
  );
}
