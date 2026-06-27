import { Globe2, TrendingUp, Video, Trophy } from "lucide-react";

const STEPS = [
  {
    icon: Globe2,
    title: "Paste your URL",
    desc: "AutoScale's LLM crawl reads your site, features, audience, and pricing — then writes your product brief. No 30-question onboarding form.",
  },
  {
    icon: TrendingUp,
    title: "Trend hop on demand",
    desc: "TrendWatch surfaces what's going viral on TikTok, Reels, and YouTube Shorts right now and proposes how to ride each trend with a video about your product. Run on click or on a 3 / 7 / 14-day schedule.",
  },
  {
    icon: Video,
    title: "Run your first batch",
    desc: "Growth Run ships 5–10 short videos as an exploration batch. Schedules them, posts through Postiz, tracks performance from day one.",
  },
  {
    icon: Trophy,
    title: "Compound the winners",
    desc: "Top performers are auto-classified and turned into variant batches. AutoScale keeps making more of what works, kills what doesn't, and learns your audience batch by batch.",
  },
] as const;

export function How() {
  return (
    <section id="how" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="grid items-start gap-12 lg:grid-cols-[1fr_1.35fr]">
          <div className="lg:sticky lg:top-32">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">How it works</p>
            <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
              From your product URL to a compounding video pipeline — in four steps.
            </h2>
            <p className="mt-5 text-base leading-relaxed text-muted-foreground text-balance md:text-lg">
              Most AI video tools start with a blank prompt. AutoScale starts with your product and today&apos;s trends —
              and never loses the thread between evidence, video, and result.
            </p>
          </div>

          <ol className="space-y-4">
            {STEPS.map((step, i) => (
              <li
                key={step.title}
                className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40 md:p-7"
              >
                <div className="flex items-start gap-5">
                  <div className="flex flex-col items-center gap-2">
                    <span className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="h-4 w-4" />
                    </span>
                    <span className="font-mono text-[10px] font-semibold text-muted-foreground">
                      {String(i + 1).padStart(2, "0")}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold tracking-tight">{step.title}</h3>
                    <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.desc}</p>
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </div>
    </section>
  );
}
