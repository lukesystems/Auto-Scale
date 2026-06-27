import {
  BarChart3,
  CalendarClock,
  FileSearch,
  Globe2,
  Repeat2,
  Sparkles,
  TrendingUp,
  Trophy,
  Video,
} from "lucide-react";

const LOOP = [
  { icon: Globe2, title: "Product URL", desc: "Drop a link to your site." },
  { icon: FileSearch, title: "LLM crawl + Brief", desc: "The AI reads your product and writes the brief." },
  { icon: TrendingUp, title: "TrendWatch", desc: "Latest viral video trends on the platforms that matter." },
  { icon: Video, title: "Growth Run", desc: "Exploration batch of 5–10 short-form video experiments." },
  { icon: CalendarClock, title: "Schedule + post", desc: "Through Postiz, or manual export fallback." },
  { icon: BarChart3, title: "Measure", desc: "Pull analytics back from every video." },
  { icon: Sparkles, title: "Classify", desc: "Winner · promising · flat · kill." },
  { icon: Trophy, title: "Compound winners", desc: "Top performers spawn variant batches." },
  { icon: Repeat2, title: "Repeat", desc: "Distribution that compounds, not resets." },
] as const;

export function Loop() {
  return (
    <section id="loop" className="border-t border-border/40 bg-secondary/30 py-20 md:py-28 overflow-hidden">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The Growth Run loop</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            One loop. Compounding video distribution.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            Your first Growth Run is an exploration batch — wide, varied, designed to learn. Every run after that
            exploits what worked, compounding winners into more variants and killing what didn&apos;t.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-6xl">
          <div className="relative rounded-2xl border border-border bg-card/70 p-6 md:p-10">
            <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.04]" />
            <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-3">
              {LOOP.map((step, index) => (
                <li
                  key={step.title}
                  className="group relative rounded-xl border border-border/60 bg-background/60 p-5 transition-all hover:border-primary/40 hover:bg-background"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-[10px] text-primary">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </li>
              ))}
            </ol>

            <div className="mt-8 flex flex-col gap-4 rounded-xl border border-primary/20 bg-primary/[0.04] p-5 md:flex-row md:items-center md:justify-between">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Exploration → Exploitation</p>
                <p className="mt-2 text-sm text-foreground/90">
                  Run 1 explores broadly. Runs 2+ exploit winners into variant batches you&apos;d never script by hand.
                </p>
              </div>
              <div className="flex items-center gap-2 font-mono text-xs text-muted-foreground">
                <span className="rounded-md border border-border bg-background px-2 py-1">batch 1: explore</span>
                <span className="text-primary">→</span>
                <span className="rounded-md border border-primary/40 bg-primary/10 px-2 py-1 text-primary">batch 2+: compound</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
