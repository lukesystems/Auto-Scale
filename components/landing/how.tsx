const STEPS = [
  {
    n: "01",
    title: "Drop your product URL",
    desc: "Add competitors, example posts, and a few founder inputs. AutoScale builds your structured growth brief.",
  },
  {
    n: "02",
    title: "Run TrendWatch",
    desc: "Reverse-engineers your niche, classifies sources, scores signal, flags distortion risk, and surfaces transferable formats.",
  },
  {
    n: "03",
    title: "Generate experiments",
    desc: "Hooks → content ideas → carousel scripts → captions → CTA slides. Every artifact linked to an insight + hypothesis.",
  },
  {
    n: "04",
    title: "Approve through Quality Gate",
    desc: "Catches generic, off-brand, duplicated, or risky content before approval. You ship only what passes.",
  },
  {
    n: "05",
    title: "Schedule via Postiz or export",
    desc: "Push approved content to Postiz for multi-platform scheduling, or grab a ZIP pack with slides, captions, and tracker.",
  },
  {
    n: "06",
    title: "Track + compound",
    desc: "Enter metrics, mark winners. Compound Engine spits out 10 variants per winner and writes next week&apos;s plan.",
  },
];

export function How() {
  return (
    <section id="how" className="py-20 md:py-28 border-t border-border/40 bg-secondary/30">
      <div className="container">
        <div className="grid lg:grid-cols-[1fr_2fr] gap-12 items-start">
          <div className="lg:sticky lg:top-32">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background text-xs font-medium text-muted-foreground">
              Workflow
            </div>
            <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
              From product page to scheduled growth experiments.
            </h2>
            <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance leading-relaxed">
              Six steps. Real persistence. Real auth. Real AI runs. Real exports. Real metrics. Real compounding.
              Not another AI content toy.
            </p>
          </div>

          <ol className="relative space-y-6">
            <div
              aria-hidden
              className="absolute left-[19px] top-3 bottom-3 w-px bg-gradient-to-b from-border via-border to-transparent"
            />
            {STEPS.map((step) => (
              <li key={step.n} className="relative flex gap-5">
                <div className="z-10 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-primary/30 bg-background font-mono text-xs font-semibold text-primary">
                  {step.n}
                </div>
                <div className="flex-1 pb-2">
                  <h3 className="font-semibold tracking-tight text-foreground">{step.title}</h3>
                  <p className="mt-1.5 text-sm text-muted-foreground leading-relaxed">{step.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
