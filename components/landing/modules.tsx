import { Brain, FileText, Filter, FlaskConical, Layers, Shield, Sparkles, Target, TrendingUp } from "lucide-react";

const MODULES = [
  {
    icon: FileText,
    name: "Product Brief Engine",
    desc: "Turn your product URL + a few founder inputs into a structured growth brief with ICP, pain map, pillars, and positioning angles.",
  },
  {
    icon: Brain,
    name: "TrendWatch",
    desc: "Market observation + competitor reverse-engineering + shadow account discovery. Not hashtag scraping.",
  },
  {
    icon: Target,
    name: "Signal Scoring Engine",
    desc: "Filters real transferable formats from follower-driven reach and entertainment-only virality.",
  },
  {
    icon: Layers,
    name: "Content Conveyor",
    desc: "Every output links to a TrendWatch insight, target pain, and a hypothesis. Carousels, scripts, captions, CTAs.",
  },
  {
    icon: Sparkles,
    name: "Visual Production",
    desc: "Template-based, editable rendering. Text stays out of images. Brand stays consistent. AI doesn't bake in mistakes.",
  },
  {
    icon: Shield,
    name: "Quality Gate",
    desc: "Hook clarity, claim believability, duplicate risk, source linkage, hypothesis present. Reject before approval.",
  },
  {
    icon: Filter,
    name: "ViralOps",
    desc: "Distribution execution layer. Postiz integration, channel mapping, gap-aware scheduling, manual export fallback.",
  },
  {
    icon: FlaskConical,
    name: "Experiment Tracker",
    desc: "Views, saves, save rate, shares, clicks, signups, revenue. Manual or imported. Every post is an experiment.",
  },
  {
    icon: TrendingUp,
    name: "Compound Engine",
    desc: "Winner diagnosis, 10× variants, format remixing, weekly plan generation. Project memory that compounds.",
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
            Nine modules. One operating system.
          </h2>
          <p className="mt-5 text-base md:text-lg text-muted-foreground text-balance">
            Not a single AI prompt. Each module owns a part of the loop, validates structured outputs, and protects the
            chain from source to variant.
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
