import { BarChart3, Brain, CalendarCheck, Factory, Gauge, Layers3, ReceiptText, Repeat2 } from "lucide-react";

const FEATURES = [
  [Brain, "VideoTrend Engine", "Finds proven short-form patterns in your niche before you create."],
  [ReceiptText, "Trend Receipts", "Every video idea includes the pattern, reference, expected signal, and why it fits your product."],
  [Gauge, "Video Strategy Score", "Shows which formats to use, which platforms to focus on, and what to avoid."],
  [Factory, "Video Factory", "Creates slides, demo shorts, AI b-roll videos, founder POV scripts, captions, and storyboards."],
  [CalendarCheck, "Postiz Publishing", "Schedules through your connected accounts so distribution does not die in week three."],
  [BarChart3, "Growth Graph", "Tracks clicks, signups, activation, and revenue so AutoScale learns what brings users."],
  [Repeat2, "Compound Engine", "Turns winners into variants and kills weak formats before they waste more time."],
  [Layers3, "Daily Growth Pack", "Delivers ready-to-post videos, hooks, variants, and recommendations for the next round."],
] as const;

export function Modules() {
  return (
    <section id="modules" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The compounding system</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Your product URL becomes the brief. The market becomes the strategy.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            Content is not the moat. The learning system that finds, measures, and multiplies winning formats is.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {FEATURES.map(([Icon, name, description]) => (
            <article key={name} className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:bg-card/80">
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold tracking-tight">{name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
