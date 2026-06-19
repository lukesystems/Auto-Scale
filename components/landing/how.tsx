const STEPS = [
  {
    n: "01",
    title: "Paste your product URL",
    desc: "AutoBrief reads the site and creates a structured brief with ICP, pain, offer, positioning, and confidence notes.",
  },
  {
    n: "02",
    title: "Build the product memory",
    desc: "The brief becomes project memory. Future findings, insights, hooks, and experiments must respect this saved context.",
  },
  {
    n: "03",
    title: "Map the market",
    desc: "AutoScale organizes relevant pages, accounts, hooks, formats, audience pain language, and white space around the niche.",
  },
  {
    n: "04",
    title: "Turn patterns into experiments",
    desc: "TrendWatch converts the evidence into hooks, ideas, campaign hypotheses, and tests tied to a clear reason.",
  },
  {
    n: "05",
    title: "Approve, export, or schedule",
    desc: "Quality Gate catches generic or unsupported content. Approved posts can be exported or scheduled through Postiz.",
  },
  {
    n: "06",
    title: "Track and compound",
    desc: "Enter metrics, mark winners, generate variants, and write the learning back into memory so the next run gets sharper.",
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
              From startup URL to source-backed experiments.
            </h2>
            <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance leading-relaxed">
              One URL starts the loop. AutoScale builds the context, maps the market, generates experiments, and remembers what worked.
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
