import { CheckCircle2, XCircle } from "lucide-react";

export function Pain() {
  return (
    <section className="py-20 md:py-28 border-t border-border/40">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
            You built the app.
            <br />
            <span className="text-muted-foreground">Nobody cares yet.</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            Building software is no longer the bottleneck. AI tools made product creation faster and cheaper.
            The new bottleneck is distribution — and most technical founders don&apos;t know where to start.
          </p>
        </div>

        <div className="mt-14 mx-auto max-w-5xl grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-destructive font-semibold">Without AutoScale</div>
            <ul className="mt-5 space-y-3">
              {[
                "You stare at a blank post editor every day",
                "You copy random viral content with no context",
                "You guess hashtags instead of analyzing signals",
                "You burn out posting random things that don't convert",
                "You can't tell what worked or why",
                "You wonder if you should just hire an agency you can't afford",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm">
                  <XCircle className="h-4 w-4 mt-0.5 shrink-0 text-destructive/70" />
                  <span className="text-foreground/80">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl border border-primary/30 bg-primary/[0.04] p-6 md:p-8 relative overflow-hidden">
            <div className="absolute -top-12 -right-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />
            <div className="text-xs uppercase tracking-widest text-primary font-semibold">With AutoScale</div>
            <ul className="mt-5 space-y-3">
              {[
                "TrendWatch reverse-engineers your niche in minutes",
                "Every post links to a proven pattern + hypothesis",
                "Signal scoring filters noise from real transferable formats",
                "Generate 30+ ideas, 20+ posts, all niche-specific",
                "Quality Gate catches weak content before you ship it",
                "Winners auto-spawn 10 variants. Losers get killed.",
              ].map((line) => (
                <li key={line} className="flex items-start gap-3 text-sm">
                  <CheckCircle2 className="h-4 w-4 mt-0.5 shrink-0 text-primary" />
                  <span className="text-foreground/90 font-medium">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </section>
  );
}
