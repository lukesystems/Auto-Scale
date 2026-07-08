import { redirect } from "next/navigation";
import { PageHeader } from "@/components/app/page-header";
import { Badge } from "@/components/ui/badge";
import { createSupabaseServerClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { getBillingOverviewAction } from "@/services/billing/checkout-actions";
import { PLANS, TOPUP_PACKS } from "@/services/billing/plans";
import { BillingActions } from "./billing-actions";

export const metadata = { title: "Billing" };

export default async function BillingSettingsPage() {
  if (!isSupabaseConfigured()) {
    return (
      <div className="container py-10 max-w-2xl">
        <PageHeader title="Billing" description="Configure Supabase first." />
      </div>
    );
  }

  const supabase = createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/sign-in");

  const overview = await getBillingOverviewAction();
  const planDef = overview?.plan ? PLANS[overview.plan as keyof typeof PLANS] : null;

  return (
    <div className="container py-10 max-w-2xl space-y-8">
      <PageHeader
        title="Billing & credits"
        description="Credits are spent on outputs — starting Growth Runs and rendering videos. Intelligence (brief, discovery, strategy) is included with any active plan."
      />

      <section className="rounded-lg border border-border p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold">Current plan</h2>
          <Badge variant={overview?.active ? "default" : "secondary"}>
            {overview?.active ? (planDef?.name ?? overview.plan ?? "Active") : "No active plan"}
          </Badge>
        </div>
        {overview?.active && overview.renewsAt ? (
          <p className="text-sm text-muted-foreground">
            Renews {new Date(overview.renewsAt).toLocaleDateString()} — plan credits reset each cycle.
          </p>
        ) : (
          <p className="text-sm text-muted-foreground">
            Choose a plan to start Growth Runs. Plans include monthly credits; top-up credits never expire.
          </p>
        )}

        <div className="grid grid-cols-3 gap-4 pt-2">
          <div className="rounded-md bg-secondary p-4 text-center">
            <div className="text-2xl font-semibold">{overview?.planCredits ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Plan credits</div>
          </div>
          <div className="rounded-md bg-secondary p-4 text-center">
            <div className="text-2xl font-semibold">{overview?.topupCredits ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Top-up credits</div>
          </div>
          <div className="rounded-md bg-secondary p-4 text-center">
            <div className="text-2xl font-semibold">{overview?.totalCredits ?? 0}</div>
            <div className="text-xs text-muted-foreground mt-1">Total</div>
          </div>
        </div>
      </section>

      <BillingActions
        active={Boolean(overview?.active)}
        currentPlan={overview?.plan ?? null}
        portalUrl={overview?.portalUrl ?? null}
        plans={Object.values(PLANS).map((p) => ({
          id: p.id,
          name: p.name,
          priceMonthly: p.priceMonthly,
          creditsPerMonth: p.creditsPerMonth,
          maxProjects: p.maxProjects,
        }))}
        topups={TOPUP_PACKS.map((t) => ({ key: t.key, name: t.name, price: t.price, credits: t.credits }))}
      />

      <p className="text-xs text-muted-foreground">
        Questions? Email{" "}
        <a className="underline" href="mailto:support@autoscaleshorts.com">
          support@autoscaleshorts.com
        </a>
        .
      </p>
    </div>
  );
}
