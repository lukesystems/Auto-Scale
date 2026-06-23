import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Sparkles, TrendingUp, Zap } from "lucide-react";

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      {/* Left panel — brand story (desktop) */}
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 -z-10 gradient-mesh" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />

        <Logo />

        <div className="space-y-8 max-w-md">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">AutoScale</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight leading-tight">
              Crack distribution
              <br />
              with videos that compound.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Find the formats that bring users, ship the variants, and compound the winners.
            </p>
          </div>

          <ul className="space-y-4">
            <Feature icon={<TrendingUp className="h-4 w-4" />} title="TrendWatch" desc="Reverse-engineer what already works in your niche" />
            <Feature icon={<Zap className="h-4 w-4" />} title="Trend-backed videos" desc="Turn proven formats into short-form video experiments" />
            <Feature icon={<Sparkles className="h-4 w-4" />} title="Compound winners" desc="Generate variants from videos that bring users" />
          </ul>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} AutoScale · Growth infrastructure for builders
        </p>
      </div>

      {/* Right panel — auth form */}
      <div className="flex flex-col min-h-screen">
        <header className="container py-6 lg:hidden">
          <Logo />
        </header>

        <main className="flex-1 flex items-center justify-center px-6 py-12">
          <div className="w-full max-w-md">
            <div className="relative">
              <div className="absolute -inset-16 -z-10 gradient-mesh opacity-40 blur-3xl lg:hidden" />
              {children}
            </div>
          </div>
        </main>

        <footer className="container py-6 text-xs text-muted-foreground flex justify-between lg:justify-center lg:gap-4">
          <span className="hidden lg:inline">Need help?</span>
          <Link href="/" className="hover:text-foreground transition-colors">
            ← Back to site
          </Link>
        </footer>
      </div>
    </div>
  );
}

function Feature({ icon, title, desc }: { icon: React.ReactNode; title: string; desc: string }) {
  return (
    <li className="flex items-start gap-3">
      <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
        {icon}
      </div>
      <div>
        <div className="text-sm font-medium">{title}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
    </li>
  );
}
