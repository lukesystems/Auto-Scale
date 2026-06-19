import { CheckCircle2, XCircle } from "lucide-react";

export function Pain() {
  return (
    <section className="py-20 md:py-28 border-t border-border/40">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
            You do not need more random content.
            <br />
            <span className="text-muted-foreground">You need market evidence.</span>
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            Product building is faster now. Distribution is still brutal. The founders who win do not just post more —
            they study what the market already responds to and test from there.
          </p>
        </div>

        <div className="mt-14 mx-auto max-w-5xl grid md:grid-cols-2 gap-4">
          <div className="rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-6 md:p-8">
            <div className="text-xs uppercase tracking-widest text-destructive font-semibold">Without AutoScale</div>
            <ul className="mt-5 space-y-3">
              {[
                "You guess what your audience cares about",
                "You copy competitors without understanding the pattern",
                "You treat likes as proof, even when they do not convert",
                "You miss the shadow accounts and adjacent creators shaping the niche",
                "You generate content before knowing what evidence supports it",
                "You cannot tell which message deserves another test",
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
                "AutoBrief turns your URL into product intelligence",
                "Competitor Intelligence maps public source signals around your niche",
                "Pattern mining surfaces hooks, CTAs, formats, pains, and white space",
                "TrendWatch turns evidence into experiments, not generic prompts",
                "Quality Gate blocks weak content before it ships",
                "Winners become variants. Weak tests get killed.",
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
