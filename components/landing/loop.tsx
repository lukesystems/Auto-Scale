import { BarChart3, Eye, Repeat, Search, Send, Wand2 } from "lucide-react";

const STEPS = [
  {
    icon: Eye,
    title: "Product Intelligence",
    subtitle: "Understand the founder's product first",
    desc: "AutoBrief reads the product URL, extracts positioning, ICP, pain, offer, CTA, features, and missing context. The brief becomes the source of truth for everything else.",
    bullet: ["URL brief", "ICP", "Pain map", "Positioning"],
  },
  {
    icon: Search,
    title: "Competitor Intelligence",
    subtitle: "Discover public market signals",
    desc: "AutoScale maps competitors, adjacent accounts, public sources, formats, hooks, CTAs, audience pain language, and market white space before generating content.",
    bullet: ["Source map", "Competitors", "Shadow accounts", "White space"],
  },
  {
    icon: Wand2,
    title: "Experiment Generation",
    subtitle: "Turn patterns into tests",
    desc: "Every hook, idea, and post draft is linked to a source-backed insight with a hypothesis and a metric to watch. No disconnected AI content. No generic vibes.",
    bullet: ["Hooks", "Scripts", "Carousels", "Hypotheses"],
  },
  {
    icon: Send,
    title: "Distribution",
    subtitle: "Approve, export, or schedule",
    desc: "Quality Gate first. Then export approved content or schedule through Postiz. AutoScale keeps the strategy layer separate from the publishing pipe.",
    bullet: ["Quality Gate", "Postiz", "ZIP export", "Tracker"],
  },
  {
    icon: Repeat,
    title: "Compound",
    subtitle: "Winners become new experiments",
    desc: "Track signals, mark winners, diagnose why they worked, generate variants, and write learnings back into project memory.",
    bullet: ["Metrics", "Winners", "Variants", "Memory"],
  },
];

export function Loop() {
  return (
    <section id="loop" className="py-20 md:py-28 border-t border-border/40 bg-secondary/30">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background text-xs font-medium text-muted-foreground">
            The Intelligence Loop
          </div>
          <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
            From product URL to source-backed growth experiments.
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            AutoScale is not a posting tool. It is a closed-loop intelligence system that gets sharper every time your project runs.
          </p>
        </div>

        <div className="mt-16 grid lg:grid-cols-5 gap-4">
          {STEPS.map((step, i) => (
            <div
              key={step.title}
              className="group relative rounded-2xl border border-border bg-card p-6 hover:border-primary/40 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300"
            >
              <div className="flex items-center justify-between">
                <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors">
                  <step.icon className="h-5 w-5" />
                </div>
                <span className="text-xs font-mono text-muted-foreground">0{i + 1}</span>
              </div>
              <div className="mt-5">
                <h3 className="font-display text-lg font-semibold tracking-tight">{step.title}</h3>
                <p className="mt-1 text-xs font-medium text-muted-foreground">{step.subtitle}</p>
              </div>
              <p className="mt-3 text-sm text-foreground/70 leading-relaxed">{step.desc}</p>
              <ul className="mt-4 flex flex-wrap gap-1.5">
                {step.bullet.map((b) => (
                  <li
                    key={b}
                    className="rounded-md border border-border bg-background px-2 py-0.5 text-[11px] font-medium text-foreground/70"
                  >
                    {b}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        <div className="mt-12 text-center">
          <div className="inline-flex items-center gap-3 rounded-full border border-border bg-card px-5 py-2.5 font-mono text-xs">
            <span className="text-muted-foreground">product</span>
            <span className="text-primary">→</span>
            <span className="text-muted-foreground">source map</span>
            <span className="text-primary">→</span>
            <span className="text-muted-foreground">insight</span>
            <span className="text-primary">→</span>
            <span className="text-muted-foreground">experiment</span>
            <span className="text-primary">→</span>
            <span className="font-semibold text-foreground">winner</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Protected evidence chain. Every serious claim should trace back to a source or be marked low confidence.
          </p>
        </div>
      </div>
    </section>
  );
}
