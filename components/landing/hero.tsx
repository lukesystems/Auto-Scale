import Link from "next/link";
import { Play, Sparkles, TrendingUp } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { UrlCta } from "@/components/landing/url-cta";

export function Hero() {
  return (
    <section className="relative pt-32 pb-20 md:pt-40 md:pb-28 overflow-hidden">
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
            Find the video format that{" "}
            <span className="text-gradient bg-[length:200%_auto] animate-gradient-shift">
              brings users.
            </span>
            <br className="hidden sm:block" />
            <span className="text-muted-foreground"> Then automate the winner.</span>
          </h1>

          <p className="mt-7 max-w-2xl mx-auto text-lg md:text-xl text-muted-foreground text-balance leading-relaxed">
            Most founders burn months posting into the void. Paste your product URL — AutoScale Shorts studies what&apos;s
            already working in your niche, ships controlled video experiments, measures signups, and compounds the
            winners.
          </p>

          <div className="mt-10 mx-auto max-w-xl">
            <UrlCta size="large" showTrustLine />
          </div>

          <div className="mt-5 flex flex-col sm:flex-row items-center justify-center gap-3">
            <Button asChild size="lg" variant="outline" className="w-full sm:w-auto">
              <Link href="#loop">See how the engine works</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm font-medium text-foreground/75">
            Evidence <span className="mx-1.5 text-primary">→</span> Controlled tests{" "}
            <span className="mx-1.5 text-primary">→</span> Business signals{" "}
            <span className="mx-1.5 text-primary">→</span> Winner variants
          </p>
          <p className="mt-3 text-xs text-muted-foreground">
            Built for founders who need to crack distribution — not automate more guessing.
          </p>
        </div>

        <div className="mt-16 md:mt-24 mx-auto max-w-5xl">
          <HeroVideoFan />
        </div>
      </div>
    </section>
  );
}

const PHONES = [
  {
    label: "Trend Hop · TikTok",
    handle: "@acme.ai",
    hook: "POV: you ship a feature in 30s",
    metric: "1.2M views",
    rotate: "-rotate-6",
    z: "z-10",
    tint: "from-pink-500/30 via-fuchsia-500/10 to-transparent",
  },
  {
    label: "Exploration · Reels",
    handle: "@acme.ai",
    hook: "I let an AI run my GTM for a week",
    metric: "Winner ✓",
    rotate: "rotate-0",
    z: "z-20 md:-translate-y-6",
    tint: "from-primary/40 via-emerald-500/10 to-transparent",
  },
  {
    label: "Variant · YT Shorts",
    handle: "@acme.ai",
    hook: "3 tools your dev team should kill",
    metric: "+42% CTR",
    rotate: "rotate-6",
    z: "z-10",
    tint: "from-amber-500/30 via-orange-500/10 to-transparent",
  },
];

function HeroVideoFan() {
  return (
    <div className="relative">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-transparent via-primary/5 to-transparent blur-3xl" />

      <div className="border-gradient relative rounded-2xl border border-border/60 bg-card/40 backdrop-blur-xl p-6 md:p-10 shadow-2xl shadow-primary/5">
        <div className="flex items-center gap-2 pb-4 border-b border-border/60">
          <div className="flex gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full bg-red-400/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-yellow-400/60" />
            <div className="h-2.5 w-2.5 rounded-full bg-green-400/60" />
          </div>
          <div className="ml-3 text-xs font-mono text-muted-foreground">autoscaleshorts.com / growth-run / acme-saas</div>
          <div className="ml-auto hidden sm:inline-flex items-center gap-1.5 text-[10px] font-mono uppercase tracking-wider text-primary">
            <span className="relative flex h-1.5 w-1.5">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
            </span>
            Exploration batch live
          </div>
        </div>

        <div className="relative mt-10 md:mt-14 mb-8 flex justify-center items-end gap-3 md:gap-6">
          {PHONES.map((p) => (
            <PhoneFrame key={p.label} {...p} />
          ))}
        </div>

        <div className="grid grid-cols-3 gap-3 md:gap-4 border-t border-border/60 pt-6 text-center">
          <Stat label="Videos shipped" value="9" />
          <Stat label="Formats tested" value="3" />
          <Stat label="Winners compounded" value="2" accent />
        </div>
      </div>
    </div>
  );
}

function PhoneFrame({
  label,
  handle,
  hook,
  metric,
  rotate,
  z,
  tint,
}: {
  label: string;
  handle: string;
  hook: string;
  metric: string;
  rotate: string;
  z: string;
  tint: string;
}) {
  return (
    <div className={`relative ${z} ${rotate} transition-transform`}>
      <div className="relative aspect-[9/16] w-24 sm:w-32 md:w-44 rounded-[1.5rem] border border-border/70 bg-background shadow-xl shadow-black/20 overflow-hidden">
        <div className={`absolute inset-0 bg-gradient-to-br ${tint}`} />
        <div className="absolute inset-0 bg-grid opacity-30" />

        <div className="absolute top-2 left-1/2 -translate-x-1/2 h-1 w-10 rounded-full bg-foreground/20" />

        <div className="absolute inset-0 flex items-center justify-center">
          <div className="flex h-10 w-10 md:h-12 md:w-12 items-center justify-center rounded-full bg-background/80 backdrop-blur border border-border/70 shadow-lg">
            <Play className="h-4 w-4 md:h-5 md:w-5 fill-foreground text-foreground" />
          </div>
        </div>

        <div className="absolute inset-x-0 bottom-0 p-2 md:p-3 space-y-1 bg-gradient-to-t from-background/95 via-background/60 to-transparent">
          <div className="text-[8px] md:text-[10px] font-mono text-primary/90 truncate">{label}</div>
          <div className="text-[8px] md:text-[10px] font-medium text-muted-foreground truncate">{handle}</div>
          <div className="text-[9px] md:text-[11px] font-semibold leading-tight line-clamp-2">{hook}</div>
          <div className="inline-flex items-center gap-1 text-[8px] md:text-[10px] font-medium text-foreground/80">
            <TrendingUp className="h-2.5 w-2.5 text-primary" />
            {metric}
          </div>
        </div>
      </div>
    </div>
  );
}

function Stat({ label, value, accent = false }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <div className={`font-display text-2xl md:text-3xl font-semibold tracking-tight ${accent ? "text-primary" : ""}`}>
        {value}
      </div>
      <div className="mt-1 text-[10px] md:text-xs font-mono uppercase tracking-wider text-muted-foreground">{label}</div>
    </div>
  );
}
