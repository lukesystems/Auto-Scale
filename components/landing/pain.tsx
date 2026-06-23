import { CheckCircle2, XCircle } from "lucide-react";

const DEAD_END = [
  "Guess what to post",
  "Publish a few videos",
  "Get weak or unclear results",
  "Stop before finding a repeatable format",
];

const FORMAT_FIRST = [
  "Test proven patterns instead of random prompts",
  "Measure users and revenue signals, not just views",
  "Kill weak formats before they waste more time",
  "Multiply winners into new hooks, angles, and variants",
];

export function Pain() {
  return (
    <section id="problem" className="border-t border-border/40 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">The real problem</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            You do not have a content problem.
            <br />
            <span className="text-muted-foreground">You have a distribution loop problem.</span>
          </h2>
          <p className="mx-auto mt-5 max-w-3xl text-base text-muted-foreground text-balance md:text-lg">
            Most founders guess what to post, publish a few videos, get weak results, then stop before they ever find a
            repeatable format.
          </p>
          <p className="mx-auto mt-5 max-w-2xl text-lg font-semibold text-foreground text-balance md:text-xl">
            More volume does not fix a bad format.
          </p>
          <p className="mx-auto mt-2 max-w-2xl text-sm text-muted-foreground text-balance">
            If your videos are not bringing users, posting more of the wrong thing only burns time faster.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 md:grid-cols-2">
          <ComparisonCard title="The distribution dead end" items={DEAD_END} negative />
          <ComparisonCard title="The format-first loop" items={FORMAT_FIRST} />
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
