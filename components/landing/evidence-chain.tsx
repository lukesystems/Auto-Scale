import { ArrowRight, Link2, Sparkles, TrendingUp, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";

const CHAIN = [
  {
    step: "Source",
    icon: Link2,
    label: "Public reference",
    detail: "tiktok.com/@devtools · POV hook pattern",
    meta: "Confidence: 82%",
    tone: "border-border bg-background/80",
  },
  {
    step: "Pattern",
    icon: TrendingUp,
    label: "Observed hook",
    detail: '"POV: you ship a feature in 30s"',
    meta: "Transferability: high",
    tone: "border-primary/20 bg-primary/[0.04]",
  },
  {
    step: "Concept",
    icon: Sparkles,
    label: "Your experiment",
    detail: "POV: you ship a feature in 30s — for your SaaS",
    meta: "Hypothesis: save rate",
    tone: "border-border bg-background/80",
  },
  {
    step: "Result",
    icon: Trophy,
    label: "Measured outcome",
    detail: "1.2k saves · 14 signups · classified winner",
    meta: "→ variant batch queued",
    tone: "border-primary/30 bg-primary/[0.06]",
  },
] as const;

export function EvidenceChain() {
  return (
    <section id="evidence" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Evidence, not vibes</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Every video traces back to a source.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            AutoScale separates observed evidence from strategic inference. You always know why a hook exists
            and what signal it is designed to test.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-5xl">
          <div className="relative rounded-2xl border border-border bg-card/60 p-6 md:p-10">
            <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/[0.03] via-transparent to-primary/[0.03]" />

            <div className="flex flex-col gap-3 md:flex-row md:items-stretch md:gap-0">
              {CHAIN.map((item, i) => (
                <div key={item.step} className="flex flex-1 items-stretch gap-3 md:gap-0">
                  <article
                    className={`flex-1 rounded-xl border p-5 transition-colors ${item.tone}`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="inline-flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10 text-primary">
                        <item.icon className="h-4 w-4" />
                      </div>
                      <Badge variant="outline" className="font-mono text-[10px] uppercase tracking-wider">
                        {item.step}
                      </Badge>
                    </div>
                    <h3 className="mt-4 text-sm font-semibold tracking-tight">{item.label}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{item.detail}</p>
                    <p className="mt-3 font-mono text-[10px] uppercase tracking-wider text-primary/90">
                      {item.meta}
                    </p>
                  </article>
                  {i < CHAIN.length - 1 && (
                    <div className="flex items-center justify-center px-1 md:px-2">
                      <ArrowRight className="hidden h-4 w-4 shrink-0 text-primary/50 md:block" />
                      <div className="h-px w-full bg-primary/20 md:hidden" />
                    </div>
                  )}
                </div>
              ))}
            </div>

            <p className="mt-8 text-center text-xs text-muted-foreground">
              Illustrative example chain. Real runs store cited sources, confidence scores, and classifier outcomes.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
