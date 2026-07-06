import { BarChart3, CalendarCheck, FileSearch, Repeat2, TrendingUp, Video } from "lucide-react";

const GROUPS = [
  {
    title: "Understand your market",
    features: [
      {
        icon: FileSearch,
        name: "LLM Site Crawl & Brief",
        description: "Your product, understood — not a generic persona doc. One URL writes your structured brief.",
        span: "",
      },
      {
        icon: TrendingUp,
        name: "TrendWatch · Viral Trend Hop",
        description: "Ride trends with your product, not as random viral bait. Manual or on a 3 / 7 / 14-day schedule.",
        span: "",
      },
    ],
  },
  {
    title: "Ship experiments",
    features: [
      {
        icon: Video,
        name: "Growth Run · Video Engine",
        description: "5–10 videos per batch. Each one tests something specific — wired to the trend evidence that justified it.",
        span: "sm:col-span-2",
      },
    ],
  },
  {
    title: "Compound what works",
    features: [
      {
        icon: Repeat2,
        name: "Compound Engine",
        description: "Winners spawn variants. Flat posts get killed. Failures become learnings the next batch inherits.",
        span: "",
      },
      {
        icon: CalendarCheck,
        name: "Multi-Account Distribution",
        description: "Schedule across connected accounts via Post Bridge.",
        span: "",
      },
      {
        icon: BarChart3,
        name: "Growth Graph",
        description: "See which format brings users — not just which video got views. Per-batch outcomes and trend ROI.",
        span: "sm:col-span-2 lg:col-span-1",
      },
    ],
  },
] as const;

export function Modules() {
  return (
    <section id="modules" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The engine</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Every part of the video loop, in one engine.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            Trend research, scripting, scheduling, measurement, and compounding — connected by an evidence chain so
            nothing gets generated in a vacuum.
          </p>
        </div>

        <div className="mt-14 space-y-12">
          {GROUPS.map((group) => (
            <div key={group.title}>
              <h3 className="text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{group.title}</h3>
              <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                {group.features.map((feature) => (
                  <article
                    key={feature.name}
                    className={`group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:bg-card/80 ${feature.span}`}
                  >
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                      <feature.icon className="h-4 w-4" />
                    </div>
                    <h4 className="mt-4 text-sm font-semibold tracking-tight">{feature.name}</h4>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{feature.description}</p>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
