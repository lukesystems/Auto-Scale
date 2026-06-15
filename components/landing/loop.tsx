import { Eye, Wand2, Send, BarChart3, Repeat } from "lucide-react";

const STEPS = [
  {
    icon: Eye,
    title: "TrendWatch",
    subtitle: "Reverse-engineer what already works",
    desc: "Analyze competitors, shadow accounts, partner accounts, and creator content. Classify formats, score signals, flag distortion risk, and surface transferable patterns specific to your niche.",
    bullet: ["Competitor map", "Shadow accounts", "Hook extraction", "Signal scoring"],
  },
  {
    icon: Wand2,
    title: "Generate",
    subtitle: "Turn proven patterns into experiments",
    desc: "Every hook, idea, and post draft is linked to a TrendWatch source with a hypothesis and a metric to watch. No disconnected AI content. No generic vibes.",
    bullet: ["30+ hooks", "Carousel scripts", "Captions", "CTA slides"],
  },
  {
    icon: Send,
    title: "Distribute",
    subtitle: "Schedule through Postiz or export",
    desc: "Quality Gate first. Then push approved content directly to Postiz for multi-platform scheduling. Or grab a ZIP export with slides, captions, and a tracker for manual posting.",
    bullet: ["Postiz scheduling", "ZIP export", "CSV / JSON", "Channel mapping"],
  },
  {
    icon: BarChart3,
    title: "Measure",
    subtitle: "Every post is an experiment",
    desc: "Track views, saves, save rate, shares, clicks, signups, and revenue. Manual or imported. Tag winners, neutrals, and losers with founder notes.",
    bullet: ["Save rate", "CTR", "Signups", "Founder notes"],
  },
  {
    icon: Repeat,
    title: "Compound",
    subtitle: "Winners spawn variants. Losers die.",
    desc: "Compound Engine explains why a winner worked, generates 10 variants, builds next week's plan, and writes learnings into your project's memory.",
    bullet: ["10 variants", "Weekly plan", "Learning memory", "Format remixing"],
  },
];

export function Loop() {
  return (
    <section id="loop" className="py-20 md:py-28 border-t border-border/40 bg-secondary/30">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background text-xs font-medium text-muted-foreground">
            The Core Loop
          </div>
          <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
            Five layers. One compounding loop.
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            AutoScale isn&apos;t a content generator. It&apos;s a closed-loop system that gets smarter every week your project runs.
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
            <span className="text-muted-foreground">source</span>
            <span className="text-primary">→</span>
            <span className="text-muted-foreground">insight</span>
            <span className="text-primary">→</span>
            <span className="text-muted-foreground">hook</span>
            <span className="text-primary">→</span>
            <span className="text-muted-foreground">post</span>
            <span className="text-primary">→</span>
            <span className="text-muted-foreground">metric</span>
            <span className="text-primary">→</span>
            <span className="font-semibold text-foreground">variant</span>
          </div>
          <p className="mt-3 text-xs text-muted-foreground">
            Protected data chain. Every artifact traces back to a real market signal.
          </p>
        </div>
      </div>
    </section>
  );
}
