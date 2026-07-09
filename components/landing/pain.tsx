import { CheckCircle2, XCircle } from "lucide-react";

const FOUNDER_PAIN = [
  "I shipped a great product. Nobody knows it exists.",
  "I tried posting. Got views — and zero signups.",
  "I don't have 4 hours a day to become a TikTok creator.",
  "Every 'AI content tool' gives me more posts, not more users.",
];

const AUTOSCALE_ANSWER = [
  "One URL. The engine handles trend research, scripting, and scheduling.",
  "Short-form video on TikTok, Reels, and Shorts — where founders actually convert.",
  "Every video is an experiment with a hypothesis — not a guess.",
  "Failures become learnings. Winners become variants you scale.",
];

const TRAP_WEEKS = [
  { week: "Week 1", label: "Enthusiasm", desc: "Post twice. Feel productive." },
  { week: "Week 3", label: "Inconsistency", desc: "Shipping wins. Content loses." },
  { week: "Week 8", label: "Guilt", desc: "Algorithm moved on. You didn't." },
  { week: "Week 12", label: "Reset", desc: "Maybe ads? Maybe another tool?" },
] as const;

export function Pain() {
  return (
    <section id="problem" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The distribution trap</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            You don&apos;t need more content.
            <br />
            <span className="text-muted-foreground">You need a format that converts.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base text-muted-foreground text-balance md:text-lg">
            Carousels and text posts won&apos;t crack distribution for most SaaS products. Short-form video will — but
            shipping it consistently is a full-time job most technical founders can&apos;t afford.
          </p>
        </div>

        <div className="mx-auto mt-12 grid max-w-5xl gap-3 sm:grid-cols-2 lg:grid-cols-4">
          {TRAP_WEEKS.map((w) => (
            <div
              key={w.week}
              className="rounded-xl border border-destructive/15 bg-destructive/[0.02] p-4 text-center"
            >
              <p className="font-mono text-[10px] uppercase tracking-wider text-destructive/80">{w.week}</p>
              <p className="mt-2 text-sm font-semibold">{w.label}</p>
              <p className="mt-1 text-xs text-muted-foreground">{w.desc}</p>
            </div>
          ))}
        </div>

        <div className="mx-auto mt-10 grid max-w-5xl gap-4 md:grid-cols-2">
          <ComparisonCard title="What founders actually face" items={FOUNDER_PAIN} negative />
          <ComparisonCard title="What AutoScale Shorts does instead" items={AUTOSCALE_ANSWER} />
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
