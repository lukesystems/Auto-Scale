"use client";

import { useTransition } from "react";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import {
  APPROVAL_POLICY_DESCRIPTIONS,
  APPROVAL_POLICY_LABELS,
  type ApprovalPolicy,
} from "@/lib/approval-policy";
import { updateApprovalPolicyAction } from "./approval-policy-actions";

const POLICIES: ApprovalPolicy[] = [
  "auto_approve_all",
  "ask_at_critical",
  "ask_at_every_stage",
];

export function ApprovalPolicyToggle({
  currentPolicy,
}: {
  currentPolicy: ApprovalPolicy;
}) {
  const [pending, startTransition] = useTransition();

  function select(policy: ApprovalPolicy) {
    if (policy === currentPolicy || pending) return;
    startTransition(async () => {
      const result = await updateApprovalPolicyAction(policy);
      if (!result.ok) {
        toast.error(result.error ?? "Failed to save.");
        return;
      }
      toast.success("Approval preference saved.");
    });
  }

  return (
    <div className="space-y-2">
      {POLICIES.map((policy) => {
        const active = currentPolicy === policy;
        return (
          <button
            key={policy}
            type="button"
            disabled={pending}
            onClick={() => select(policy)}
            className={cn(
              "w-full rounded-lg border p-3 text-left transition-colors",
              active
                ? "border-primary bg-primary/10"
                : "border-border hover:border-primary/40 hover:bg-secondary/50",
              pending && "opacity-60"
            )}
          >
            <p className="text-sm font-medium">{APPROVAL_POLICY_LABELS[policy]}</p>
            <p className="mt-1 text-xs text-muted-foreground">
              {APPROVAL_POLICY_DESCRIPTIONS[policy]}
            </p>
          </button>
        );
      })}
    </div>
  );
}
