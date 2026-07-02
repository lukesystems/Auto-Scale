import { BarChart3, CalendarCheck, FileSearch, Repeat2, TrendingUp, Video } from "lucide-react";

const FEATURES = [
  [
    FileSearch,
    "LLM Site Crawl & Brief",
    "An AI reads your product, audience, and pricing — and writes your structured Product Brief. No long onboarding form.",
  ],
  [
    TrendingUp,
    "TrendWatch · Viral Trend Hop",
    "Scans short-form trends on TikTok, Reels, and YouTube Shorts and proposes how to hop on each one with a video about your product. Manual or on a 3 / 7 / 14-day schedule.",
  ],
  [
    Video,
    "Growth Run · Autonomous Video Engine",
    "Generates 5–10 short-form video experiments per batch — scripts, storyboards, captions, hooks — wired to the trend evidence that justified them.",
  ],
  [
    Repeat2,
    "Compound Engine",
    "Classifies every video (winner · promising · flat · kill) and turns winners into variant batches. Failures become learnings the next batch inherits.",
  ],
  [
    CalendarCheck,
    "Multi-Account Distribution",
    "Schedule across connected accounts via Postiz, or fall back to a clean export pack for manual posting. Distribution doesn't die in week three.",
  ],
  [
    BarChart3,
    "Growth Graph",
    "Per-video analytics, per-batch outcomes, per-trend ROI. The graph that tells you which formats are compounding and which to kill.",
  ],
] as const;

export function Modules() {
  return (
    <section id="modules" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The engine</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Every part of the video loop, in one engine.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            Trend research, scripting, scheduling, measurement, and compounding — connected by an evidence chain so
            nothing gets generated in a vacuum.
          </p>
        </div>

        <div className="mt-14 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([Icon, name, description]) => (
            <article
              key={name}
              className="group rounded-xl border border-border bg-card p-6 transition-all hover:border-primary/40 hover:bg-card/80"
            >
              <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <Icon className="h-4 w-4" />
              </div>
              <h3 className="mt-4 text-sm font-semibold tracking-tight">{name}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{description}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}
