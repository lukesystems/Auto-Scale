import { Brain, FileText, Filter, FlaskConical, Layers, Shield, Sparkles, Target, TrendingUp } from "lucide-react";

const MODULES = [
  {
    icon: FileText,
    name: "Product Intelligence Engine",
    desc: "Turn a product URL into a structured brief with ICP, pain, offer, positioning, content pillars, and confidence notes.",
  },
  {
    icon: Brain,
    name: "Competitor Intelligence Engine",
    desc: "Study the niche around competitors, adjacent accounts, public pages, repeated hooks, formats, audience pain, and market white space.",
  },
  {
    icon: Target,
    name: "Signal Scoring Engine",
    desc: "Filters transferable patterns from follower-driven reach, vanity engagement, and entertainment-only virality.",
  },
  {
    icon: Layers,
    name: "Content Conveyor",
    desc: "Every output links to a source-backed insight, target pain, and hypothesis. Carousels, scripts, captions, and CTAs.",
  },
  {
    icon: Sparkles,
    name: "Visual Production",
    desc: "Template-based, editable rendering. Text stays out of images. Brand stays consistent. AI does not bake in mistakes.",
  },
  {
    icon: Shield,
    name: "Quality Gate",
    desc: "Hook clarity, claim believability, duplicate risk, source linkage, and hypothesis checks before approval.",
  },
  {
    icon: Filter,
    name: "Distribution Layer",
    desc: "Postiz integration, channel mapping, gap-aware scheduling, and manual export fallback.",
  },
  {
    icon: FlaskConical,
    name: "Experiment Tracker",
    desc: "Views, saves, save rate, shares, clicks, signups, revenue, and notes. Every post is treated as an experiment.",
  },
  {
    icon: TrendingUp,
    name: "Compound Engine",
    desc: "Winner diagnosis, variants, format remixing, weekly plan generation, and project memory that compounds.",
  },
];

export function Modules() {
  return (
    <section id="modules" className="py-20 md:py-28 border-t border-border/40">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-secondary text-xs font-medium text-muted-foreground">
            Inside AutoScale
          </div>
          <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
            Nine modules. One intelligence system.
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            Not a single prompt. Each module owns part of the chain, validates structured output, and protects the path
            from product context to winner variants.
          </p>
        </div>

        <div className="mt-14 grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {MODULES.map((m) => (
            <div
              key={m.name}
              className="group rounded-xl border border-border bg-card p-6 hover:border-primary/40 hover:bg-card/80 transition-all"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary group-hover:scale-110 transition-transform">
                <m.icon className="h-4.5 w-4.5" />
              </div>
              <h3 className="mt-4 font-semibold tracking-tight">{m.name}</h3>
              <p className="mt-2 text-sm text-muted-foreground leading-relaxed">{m.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
