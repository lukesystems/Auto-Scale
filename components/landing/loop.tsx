import { BarChart3, Repeat2, Search, Video } from "lucide-react";
import { GrowthLoop } from "@/components/growth-loop";

const LOOP = [
  {
    icon: Search,
    title: "Find what works",
    description:
      "AutoScale studies proven video patterns, hooks, formats, creator angles, competitor moves, and audience language in your niche. No blank-page guessing.",
  },
  {
    icon: Video,
    title: "Ship videos",
    description:
      "AutoScale creates scripts, storyboards, captions, slides, demo shorts, AI b-roll, and ready-to-post TikToks, Reels, and Shorts.",
  },
  {
    icon: BarChart3,
    title: "Track users",
    description:
      "Track views, clicks, signups, activation, and revenue signals so you know what actually moves the business.",
  },
  {
    icon: Repeat2,
    title: "Compound winners",
    description:
      "When a video works, AutoScale creates new hooks, angles, and formats from the same proven pattern. Weak formats get killed. Winners get multiplied.",
  },
] as const;

export function Loop() {
  return (
    <section id="loop" className="border-t border-border/40 bg-secondary/30 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The solution</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            AutoScale helps you find the formats worth scaling.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            Paste your product URL. AutoScale studies your product, niche, competitors, and proven short-form patterns,
            then creates video experiments, posts them through your accounts, tracks what brings users, and turns
            winners into more variants.
          </p>
          <p className="mt-5 text-sm font-medium text-foreground/80">
            You do not need to be a natural marketer. You need a system that tests faster than you can guess.
          </p>
        </div>

        <GrowthLoop className="mx-auto mt-10 max-w-4xl" />

        <ol className="mx-auto mt-14 grid max-w-6xl overflow-hidden rounded-2xl border border-border bg-card/70 md:grid-cols-2 lg:grid-cols-4">
          {LOOP.map((step, index) => (
            <li key={step.title} className="border-b border-border p-6 last:border-b-0 md:border-r md:[&:nth-child(2)]:border-r-0 lg:border-b-0 lg:[&:nth-child(2)]:border-r">
              <div className="flex items-center justify-between">
                <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </div>
                <span className="font-mono text-[10px] text-primary">{String(index + 1).padStart(2, "0")}</span>
              </div>
              <h3 className="mt-5 text-base font-semibold tracking-tight">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{step.description}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}
