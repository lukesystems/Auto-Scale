import {
  BarChart3,
  CalendarClock,
  FileSearch,
  Globe2,
  Repeat2,
  Sparkles,
  TrendingUp,
  Trophy,
  Video,
} from "lucide-react";
import { LoopBatchToggle } from "@/components/landing/loop-batch-toggle";

const LOOP = [
  { icon: Globe2, title: "Product URL", desc: "Drop a link to your site." },
  { icon: FileSearch, title: "LLM crawl + Brief", desc: "The AI reads your product and writes the brief." },
  { icon: TrendingUp, title: "Deep discovery", desc: "Hunt competitors, shadow accounts, and niche patterns from public evidence." },
  { icon: Video, title: "Video evidence + Growth Run", desc: "Reverse-engineer TikTok/Reels/Shorts hooks, then ship experiments." },
  { icon: CalendarClock, title: "Schedule + post", desc: "Gap-aware scheduling through Post Bridge." },
  { icon: BarChart3, title: "Measure", desc: "Save rate, views, and signups from every post." },
  { icon: Sparkles, title: "Classify", desc: "Winner · promising · flat · kill (save-rate aware)." },
  { icon: Trophy, title: "Compound winners", desc: "Proven hooks spawn variant batches." },
  { icon: Repeat2, title: "Repeat", desc: "Distribution that compounds, not resets." },
] as const;

export function Loop() {
  return (
    <section id="loop" className="border-t border-border/40 bg-secondary/30 py-20 md:py-28 overflow-hidden">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The Growth Run loop</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            One loop. Compounding video distribution.
          </h2>
          <p className="mt-5 text-base text-muted-foreground text-balance md:text-lg">
            Without a loop, every Monday resets to zero. Your first Growth Run explores broadly. Every run after
            exploits what worked — compounding winners into variants and killing what didn&apos;t.
          </p>
        </div>

        <div className="mx-auto mt-14 max-w-6xl">
          <div className="relative rounded-2xl border border-border bg-card/70 p-6 md:p-10">
            <div className="absolute inset-0 -z-10 rounded-2xl bg-gradient-to-br from-primary/[0.04] via-transparent to-primary/[0.04]" />
            <ol className="grid gap-3 md:grid-cols-3 lg:grid-cols-3">
              {LOOP.map((step, index) => (
                <li
                  key={step.title}
                  className="group relative rounded-xl border border-border/60 bg-background/60 p-5 transition-all hover:border-primary/40 hover:bg-background"
                >
                  <div className="flex items-center justify-between">
                    <div className="inline-flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
                      <step.icon className="h-4 w-4" />
                    </div>
                    <span className="font-mono text-[10px] text-primary">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <h3 className="mt-4 text-sm font-semibold tracking-tight">{step.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-muted-foreground">{step.desc}</p>
                </li>
              ))}
            </ol>

            <LoopBatchToggle />
          </div>
        </div>
      </div>
    </section>
  );
}
