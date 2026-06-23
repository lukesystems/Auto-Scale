import { Check, X } from "lucide-react";

const GENERIC = ["Generate videos from prompts", "Chase volume", "Track views", "Leave you guessing"];
const AUTOSCALE = ["Finds proven patterns", "Creates trend-backed videos", "Tracks what brings users", "Compounds your winners"];

export function Differentiation() {
  return (
    <section className="border-t border-border/40 bg-secondary/30 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            Volume only works after the format works.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground text-balance md:text-lg">
            Generic tools make more videos. AutoScale finds the formats that bring users, then scales them.
          </p>
        </div>
        <div className="mx-auto mt-14 grid max-w-5xl overflow-hidden rounded-2xl border border-border bg-card md:grid-cols-2">
          <Comparison title="Generic AI video tools" items={GENERIC} />
          <Comparison title="AutoScale" items={AUTOSCALE} autoscale />
        </div>
      </div>
    </section>
  );
}

function Comparison({ title, items, autoscale = false }: { title: string; items: string[]; autoscale?: boolean }) {
  const Icon = autoscale ? Check : X;
  return (
    <div className={autoscale ? "border-t border-primary/20 bg-primary/[0.04] p-7 md:border-l md:border-t-0 md:p-9" : "p-7 md:p-9"}>
      <h3 className={autoscale ? "font-semibold text-primary" : "font-semibold text-muted-foreground"}>{title}</h3>
      <ul className="mt-5 space-y-3">
        {items.map((item) => (
          <li key={item} className="flex items-start gap-3 text-sm">
            <Icon className={autoscale ? "mt-0.5 h-4 w-4 shrink-0 text-primary" : "mt-0.5 h-4 w-4 shrink-0 text-muted-foreground"} />
            <span className={autoscale ? "font-medium text-foreground" : "text-muted-foreground"}>{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}
