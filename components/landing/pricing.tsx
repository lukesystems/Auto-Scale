import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Starter",
    price: 49,
    tagline: "For solo founders shipping their first growth loop.",
    features: [
      "1 project",
      "1 TrendWatch run / month",
      "30 content ideas / month",
      "10 generated posts / month",
      "Basic Postiz scheduling",
      "Manual metrics tracker",
      "ZIP / CSV / JSON export",
    ],
    cta: "Start with Starter",
    highlight: false,
  },
  {
    name: "Growth",
    price: 149,
    tagline: "For serious founders running weekly experiments.",
    features: [
      "3 projects",
      "4 TrendWatch runs / month",
      "120 content ideas / month",
      "40 generated posts / month",
      "Full Postiz scheduling",
      "Winner-to-variants engine",
      "Competitor tracking",
      "Experiment tracker",
    ],
    cta: "Choose Growth",
    highlight: true,
  },
  {
    name: "Operator",
    price: 399,
    tagline: "For startups and teams running multi-channel programs.",
    features: [
      "10 projects",
      "Weekly TrendWatch",
      "300 generated posts / month",
      "Multi-channel workflow",
      "Advanced variant engine",
      "Learning memory",
      "Weekly growth plan",
      "Priority generation",
    ],
    cta: "Go Operator",
    highlight: false,
  },
];

export function Pricing() {
  return (
    <section id="pricing" className="py-20 md:py-28 border-t border-border/40">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary text-xs font-medium text-muted-foreground">
            Pricing
          </div>
          <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
            Cheaper than a part-time marketer.
            <br />
            <span className="text-muted-foreground">Smarter than an agency retainer.</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            Start with Starter while you learn the loop. Move up when winners start compounding.
          </p>
        </div>

        <div className="mt-14 grid md:grid-cols-3 gap-5 max-w-6xl mx-auto">
          {PLANS.map((plan) => (
            <div
              key={plan.name}
              className={`relative rounded-2xl border p-7 transition-all ${
                plan.highlight
                  ? "border-primary/50 bg-card shadow-lg shadow-primary/10 md:scale-[1.02]"
                  : "border-border bg-card hover:border-primary/30"
              }`}
            >
              {plan.highlight && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <div className="inline-flex items-center rounded-full bg-primary px-3 py-1 text-xs font-semibold text-primary-foreground shadow-md">
                    Most popular
                  </div>
                </div>
              )}

              <h3 className="font-display text-xl font-semibold tracking-tight">{plan.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground text-balance">{plan.tagline}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">${plan.price}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>

              <Button
                asChild
                className="mt-6 w-full"
                variant={plan.highlight ? "default" : "outline"}
                size="lg"
              >
                <Link href="/auth/sign-up">{plan.cta}</Link>
              </Button>

              <ul className="mt-6 space-y-2.5">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2.5 text-sm">
                    <Check className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                    <span className="text-foreground/80">{feature}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <p className="mt-10 text-center text-xs text-muted-foreground">
          14-day money back. Cancel anytime. Concierge onboarding available for $499 setup.
        </p>
      </div>
    </section>
  );
}
