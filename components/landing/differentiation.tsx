import { Code2, Cpu, Rocket, Wrench } from "lucide-react";

const AUDIENCES = [
  { icon: Cpu, label: "SaaS founders", desc: "Turn the product you can demo into distribution you can measure." },
  { icon: Wrench, label: "Dev tool builders", desc: "Trend-hop technical content without becoming a part-time creator." },
  { icon: Rocket, label: "AI product teams", desc: "Ship video experiments at the pace your product moves." },
  { icon: Code2, label: "Indie hackers", desc: "One operator. One URL. A compounding distribution loop." },
];

export function Differentiation() {
  return (
    <section className="border-t border-border/40 bg-secondary/30 py-20 md:py-28">
      <div className="container">
        <div className="mx-auto max-w-4xl text-center">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-primary">Built for technical founders</p>
          <h2 className="mt-4 font-display text-3xl font-semibold tracking-tight text-balance md:text-5xl">
            We do the social media labor so you ship product.
          </h2>
          <p className="mx-auto mt-5 max-w-2xl text-base text-muted-foreground text-balance md:text-lg">
            AutoScale is not a content tool for marketers. It&apos;s a growth engine for founders who&apos;d rather be in
            the IDE than in TikTok&apos;s composer.
          </p>
        </div>

        <div className="mx-auto mt-14 grid max-w-5xl gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {AUDIENCES.map((a) => (
            <div
              key={a.label}
              className="group relative rounded-2xl border border-border bg-card p-6 transition-all hover:border-primary/40"
            >
              <div className="inline-flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10 text-primary transition-transform group-hover:scale-105">
                <a.icon className="h-5 w-5" />
              </div>
              <h3 className="mt-4 text-sm font-semibold tracking-tight">{a.label}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">{a.desc}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
