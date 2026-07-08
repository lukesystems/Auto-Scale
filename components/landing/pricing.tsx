import Link from "next/link";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

const PLANS = [
  {
    name: "Launch",
    verb: "Learn",
    price: 49,
    tagline: "For solo founders shipping their first Growth Run.",
    weekOne: "1 exploration batch",
    features: [
      "25 credits / month",
      "1 project",
      "~2 Growth Runs / month",
      "5–8 videos per batch",
      "TrendWatch refresh weekly",
      "Post Bridge scheduling (1 account / platform)",
      "ZIP / CSV export fallback",
    ],
    cta: "Start with Launch",
    highlight: false,
  },
  {
    name: "Growth",
    verb: "Compound",
    price: 149,
    tagline: "For founders compounding winners weekly.",
    weekOne: "2 batches + 1 variant run",
    features: [
      "80 credits / month",
      "3 projects",
      "~6 Growth Runs / month",
      "8–10 videos per batch",
      "TrendWatch refresh every 3 days",
      "Variant batches from winners",
      "Multi-account Post Bridge scheduling",
      "Per-video Growth Graph",
    ],
    cta: "Choose Growth",
    highlight: true,
  },
  {
    name: "Operator",
    verb: "Scale",
    price: 399,
    tagline: "For teams running multi-product distribution.",
    weekOne: "~25 runs + concierge",
    features: [
      "250 credits / month",
      "10 projects",
      "~25 Growth Runs / month",
      "10+ videos per batch",
      "Daily TrendWatch refresh",
      "Advanced variant engine + learning memory",
      "Priority video generation",
      "Weekly growth plan + concierge onboarding",
    ],
    cta: "Go Operator",
    highlight: false,
  },
];

const ANCHORS = [
  { label: "Freelance UGC creator", value: "$3–5k/mo" },
  { label: "Growth agency retainer", value: "$8k+/mo" },
  { label: "AutoScale Growth", value: "$149/mo", accent: true },
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
            Cheaper than a part-time creator.
            <br />
            <span className="text-muted-foreground">Faster than learning TikTok yourself.</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            One winning format can pay for a year of Growth. Start with one exploration batch — move up when the loop
            compounds.
          </p>
        </div>

        <div className="mx-auto mt-10 flex max-w-2xl flex-wrap items-center justify-center gap-4 md:gap-8">
          {ANCHORS.map((a) => (
            <div key={a.label} className="text-center">
              <p className="text-[10px] font-mono uppercase tracking-wider text-muted-foreground">{a.label}</p>
              <p className={`mt-1 text-lg font-semibold ${a.accent ? "text-primary" : ""}`}>{a.value}</p>
            </div>
          ))}
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

              <div className="flex items-baseline gap-2">
                <h3 className="font-display text-xl font-semibold tracking-tight">{plan.name}</h3>
                <span className="font-mono text-[10px] uppercase tracking-wider text-primary">{plan.verb}</span>
              </div>
              <p className="mt-2 text-sm text-muted-foreground text-balance">{plan.tagline}</p>

              <div className="mt-6 flex items-baseline gap-1">
                <span className="text-4xl font-semibold tracking-tight">${plan.price}</span>
                <span className="text-sm text-muted-foreground">/month</span>
              </div>

              <p className="mt-4 rounded-lg border border-border/80 bg-secondary/50 px-3 py-2 text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">Week 1: </span>
                {plan.weekOne}
              </p>

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
          14-day money back. Cancel anytime. Plan limits scale per Growth Run, not per post.
        </p>
      </div>
    </section>
  );
}
