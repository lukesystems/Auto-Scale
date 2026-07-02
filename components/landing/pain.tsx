import { CheckCircle2, XCircle } from "lucide-react";

const FOUNDER_PAIN = [
  "You're a technical founder. You can't spend 4 hours a day on TikTok.",
  "Carousel and text-post tools won't bring users — short-form video is where distribution lives now.",
  "You don't know what's trending today, let alone how to hop on a trend with your product.",
  "Every video is a shot in the dark. No system to learn what actually works.",
];

const AUTOSCALE_ANSWER = [
  "Paste a URL. The engine handles trend research, scripting, and scheduling for you.",
  "Short-form video on TikTok, Reels, and YouTube Shorts — the channels users actually convert from.",
  "TrendWatch surfaces viral trends and proposes how to ride them with a video about your product.",
  "Every Growth Run is an experiment. Winners compound into variants. Failures become learnings.",
];

export function Pain() {
  return (
    <section id="problem" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Why founders stall on social</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            You don&apos;t need another carousel tool.
            <br />
            <span className="text-muted-foreground">You need a video growth engine.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base text-muted-foreground text-balance md:text-lg">
            Carousels and text posts don&apos;t bring users anymore. Short-form video does — and shipping it consistently
            is a full-time job most technical founders can&apos;t afford.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-2">
          <ComparisonCard title="What founders actually face" items={FOUNDER_PAIN} negative />
          <ComparisonCard title="What AutoScale does instead" items={AUTOSCALE_ANSWER} />
        </div>
      </div>
    </section>
  );
}

function ComparisonCard({ title, items, negative = false }: { title: string; items: string[]; negative?: boolean }) {
  const Icon = negative ? XCircle : CheckCircle2;
  return (
    <div
      className={
        negative
          ? "rounded-2xl border border-destructive/20 bg-destructive/[0.03] p-6 md:p-8"
          : "relative overflow-hidden rounded-2xl border border-primary/30 bg-primary/[0.04] p-6 md:p-8"
      }
    >
      {negative ? null : <div className="absolute -right-12 -top-12 h-40 w-40 rounded-full bg-primary/10 blur-3xl" />}
      <div className={negative ? "text-xs font-semibold uppercase tracking-widest text-destructive" : "text-xs font-semibold uppercase tracking-widest text-primary"}>
        {title}
      </div>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm">
            <Icon className={negative ? "mt-0.5 h-4 w-4 shrink-0 text-destructive/70" : "mt-0.5 h-4 w-4 shrink-0 text-primary"} />
            <span className={negative ? "text-foreground/80" : "font-medium text-foreground/90"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
