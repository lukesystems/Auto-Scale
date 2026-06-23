const CHAIN = [
  "Product URL",
  "Trend evidence",
  "Video strategy",
  "Video creation",
  "Posting",
  "Tracking",
  "Winner variants",
] as const;

export function How() {
  return (
    <section id="how" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.35fr]">
          <div className="lg:sticky lg:top-32">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The core mechanism</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              Most tools help you make videos. AutoScale helps you find what deserves to be made.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground text-balance md:text-lg">
              Generic AI video tools start with a prompt. AutoScale starts with your product URL and market evidence.
            </p>
          </div>

          <div className="space-y-6">
            <ol className="overflow-hidden rounded-2xl border border-border bg-card">
              {CHAIN.map((step, index) => (
                <li key={step} className="flex items-center gap-4 border-b border-border px-5 py-4 last:border-b-0">
                  <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 font-mono text-[10px] font-semibold text-primary">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <span className="text-sm font-medium">{step}</span>
                  {index < CHAIN.length - 1 ? <span className="ml-auto text-primary">→</span> : null}
                </li>
              ))}
            </ol>

            <div className="rounded-2xl border border-primary/30 bg-primary/[0.05] p-6 md:p-8">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The psychological promise</p>
              <p className="mt-4 text-sm text-muted-foreground">You will stop asking:</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight">“What should I post?”</p>
              <p className="mt-6 text-sm text-muted-foreground">And start seeing:</p>
              <p className="mt-2 font-display text-2xl font-semibold tracking-tight text-primary">
                “This format brings users. Make 10 more.”
              </p>
              <p className="mt-6 text-sm leading-relaxed text-muted-foreground">
                That is the difference between generating videos and cracking distribution.
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
