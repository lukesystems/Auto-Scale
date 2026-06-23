import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { GrowthLoop } from "@/components/growth-loop";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
      {/* Background layers */}
      <div className="absolute inset-0 -z-10 gradient-mesh" />
      <div className="absolute inset-0 -z-10 bg-grid opacity-[0.4] [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_75%)]" />
      <div className="absolute inset-x-0 top-0 -z-10 h-px bg-gradient-to-r from-transparent via-primary/30 to-transparent" />

      <div className="container relative">
        <div className="mx-auto max-w-4xl text-center animate-fade-up">
          <div className="inline-flex">
            <Badge variant="outline" className="px-3 py-1.5 text-xs font-medium border-primary/30 bg-primary/5 text-primary">
              <Sparkles className="h-3 w-3" />
              AI short-form growth agent for SaaS founders
            </Badge>
          </div>

          <h1 className="mt-6 font-display text-5xl md:text-7xl lg:text-[5.25rem] font-semibold tracking-tight text-balance leading-[0.95]">
            Find the video format that brings users.{" "}
            <span className="text-gradient bg-[length:200%_auto] animate-gradient-shift">
              Then automate the winner.
            </span>
          </h1>

          <p className="mt-7 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground text-balance leading-relaxed">
            AutoScale studies your product and niche, turns proven patterns into controlled short-form video tests,
            publishes through your accounts, tracks clicks, signups, and revenue, then scales the formats that work.
          </p>

          <div className="mt-10 flex items-center justify-center">
            <Button asChild size="xl" variant="glow" className="w-full sm:w-auto">
              <Link href="/auth/sign-up">
                Find My Winning Format
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
          </div>

          <p className="mt-6 text-sm font-medium text-foreground/75">
            Evidence <span className="mx-1.5 text-primary">→</span> Controlled tests{" "}
            <span className="mx-1.5 text-primary">→</span> Business signals{" "}
            <span className="mx-1.5 text-primary">→</span> Winner variants
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Built for founders who need to crack distribution—not automate more guessing.
          </p>
        </div>

        {/* Hero visual */}
        <div className="mt-16 md:mt-24 mx-auto max-w-6xl">
          <HeroLoopVisual />
        </div>
      </div>
    </section>
  );
}

function HeroLoopVisual() {
  const steps = [
    { label: "Trend Research", desc: "Study your niche", color: "from-blue-500/20 to-blue-500/5" },
    { label: "Video Creation", desc: "TikToks, Reels, Shorts", color: "from-purple-500/20 to-purple-500/5" },
    { label: "Posting", desc: "Through your accounts", color: "from-pink-500/20 to-pink-500/5" },
    { label: "Tracking", desc: "Measure what lands", color: "from-amber-500/20 to-amber-500/5" },
    { label: "Winners", desc: "Compound variants", color: "from-primary/20 to-primary/5" },
  ];

  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent blur-3xl" />

      <div className="border-gradient relative rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 md:p-8 shadow-2xl shadow-primary/5">
        <div className="flex items-center gap-2 pb-4 border-b border-border/60">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          </div>
          <div className="ml-3 text-xs font-mono text-muted-foreground">autoscale.app / growth-run / acme-saas</div>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-5 gap-3 md:gap-4 pt-6">
          {steps.map((step, i) => (
            <div
              key={step.label}
              className="group relative rounded-xl border border-border/60 bg-background/60 p-4 hover:border-primary/40 hover:bg-background transition-all duration-300"
              style={{ animationDelay: `${i * 100}ms` }}
            >
              <div className={`absolute inset-0 -z-10 rounded-xl bg-gradient-to-br ${step.color} opacity-0 group-hover:opacity-100 transition-opacity`} />
              <div className="text-[10px] font-mono text-muted-foreground mb-2">0{i + 1}</div>
              <div className="text-sm font-semibold">{step.label}</div>
              <div className="mt-1 text-xs text-muted-foreground">{step.desc}</div>
              {i < steps.length - 1 && (
                <div className="hidden md:block absolute top-1/2 -right-2.5 translate-y-[-50%] z-10">
                  <div className="h-px w-5 bg-border" />
                </div>
              )}
            </div>
          ))}
        </div>

        <GrowthLoop className="mt-6 border-t border-border/60 pt-6" compact />
      </div>
    </div>
  );
}
