"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  createPlanCheckoutAction,
  createTopupCheckoutAction,
} from "@/services/billing/checkout-actions";

interface PlanRow {
  id: string;
  name: string;
  priceMonthly: number;
  creditsPerMonth: number;
  maxProjects: number;
}

interface TopupRow {
  key: "small" | "medium" | "large";
  name: string;
  price: number;
  credits: number;
}

export function BillingActions(props: {
  active: boolean;
  currentPlan: string | null;
  portalUrl: string | null;
  plans: PlanRow[];
  topups: TopupRow[];
}) {
  const [pending, startTransition] = useTransition();
  const [busyKey, setBusyKey] = useState<string | null>(null);

  function checkoutPlan(planId: string) {
    setBusyKey(`plan:${planId}`);
    startTransition(async () => {
      const result = await createPlanCheckoutAction(planId);
      setBusyKey(null);
      if (result.ok) window.location.href = result.url;
      else toast.error(result.error);
    });
  }

  function checkoutTopup(pack: TopupRow["key"]) {
    setBusyKey(`topup:${pack}`);
    startTransition(async () => {
      const result = await createTopupCheckoutAction(pack);
      setBusyKey(null);
      if (result.ok) window.location.href = result.url;
      else toast.error(result.error);
    });
  }

  return (
    <>
      <section className="rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold">{props.active ? "Change plan" : "Choose a plan"}</h2>
        <div className="grid gap-3 sm:grid-cols-3">
          {props.plans.map((plan) => (
            <div key={plan.id} className="rounded-md border border-border p-4 space-y-2">
              <div className="font-medium">{plan.name}</div>
              <div className="text-2xl font-semibold">
                ${plan.priceMonthly}
                <span className="text-xs font-normal text-muted-foreground">/mo</span>
              </div>
              <div className="text-xs text-muted-foreground">
                {plan.creditsPerMonth} credits · {plan.maxProjects} project
                {plan.maxProjects === 1 ? "" : "s"}
              </div>
              <Button
                size="sm"
                className="w-full"
                variant={props.currentPlan === plan.id ? "secondary" : "default"}
                disabled={pending || props.currentPlan === plan.id}
                onClick={() => checkoutPlan(plan.id)}
              >
                {props.currentPlan === plan.id
                  ? "Current plan"
                  : busyKey === `plan:${plan.id}`
                    ? "Opening checkout…"
                    : props.active
                      ? "Switch"
                      : "Subscribe"}
              </Button>
            </div>
          ))}
        </div>
        {props.portalUrl ? (
          <p className="text-xs text-muted-foreground">
            Manage payment method or cancel in the{" "}
            <a className="underline" href={props.portalUrl} target="_blank" rel="noreferrer">
              customer portal
            </a>
            .
          </p>
        ) : null}
      </section>

      <section className="rounded-lg border border-border p-6 space-y-4">
        <h2 className="text-lg font-semibold">Top up credits</h2>
        <p className="text-sm text-muted-foreground">
          Top-up credits never expire and are used after your plan credits run out.
        </p>
        <div className="grid gap-3 sm:grid-cols-3">
          {props.topups.map((pack) => (
            <div key={pack.key} className="rounded-md border border-border p-4 space-y-2">
              <div className="font-medium">{pack.name}</div>
              <div className="text-2xl font-semibold">${pack.price}</div>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={pending || !props.active}
                onClick={() => checkoutTopup(pack.key)}
              >
                {busyKey === `topup:${pack.key}` ? "Opening checkout…" : "Buy"}
              </Button>
            </div>
          ))}
        </div>
        {!props.active ? (
          <p className="text-xs text-muted-foreground">Subscribe to a plan before buying top-ups.</p>
        ) : null}
      </section>
    </>
  );
}
