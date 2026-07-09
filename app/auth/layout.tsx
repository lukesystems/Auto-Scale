import Link from "next/link";
import { Logo } from "@/components/brand/logo";
import { Globe2, Shield, Sparkles, TrendingUp } from "lucide-react";

const STEPS = [
  { icon: Globe2, label: "Paste your URL", desc: "No long onboarding form" },
  { icon: TrendingUp, label: "Evidence + brief", desc: "Runs while you work" },
  { icon: Sparkles, label: "First Growth Run", desc: "Exploration batch ships" },
] as const;

export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="min-h-screen grid lg:grid-cols-2 bg-background">
      <div className="relative hidden lg:flex flex-col justify-between p-12 overflow-hidden">
        <div className="absolute inset-0 -z-10 gradient-mesh" />
        <div className="absolute inset-0 -z-10 bg-grid opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_40%,transparent_80%)]" />

        <Logo />

        <div className="space-y-8 max-w-md">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-primary">AutoScale Shorts</p>
            <h2 className="mt-3 font-display text-3xl font-semibold tracking-tight leading-tight">
              Find the format that brings users.
              <br />
              Then automate the winner.
            </h2>
            <p className="mt-4 text-muted-foreground leading-relaxed">
              Evidence → controlled tests → business signals → winner variants. Built for founders who measure
              signups, not impressions.
            </p>
          </div>

          <ol className="space-y-4">
            {STEPS.map((step, i) => (
              <li key={step.label} className="flex items-start gap-3">
                <div className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <step.icon className="h-4 w-4" />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-[10px] text-muted-foreground">{String(i + 1).padStart(2, "0")}</span>
                    <div className="text-sm font-medium">{step.label}</div>
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">{step.desc}</div>
                </div>
              </li>
            ))}
          </ol>

          <div className="flex items-start gap-2 rounded-lg border border-border/80 bg-card/50 px-3 py-2.5 text-xs text-muted-foreground">
            <Shield className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" />
            <span>You approve videos before anything posts. Approval policy is yours to set.</span>
          </div>
        </div>

        <p className="text-xs text-muted-foreground">
          © {new Date().getFullYear()} AutoScale Shorts · Growth infrastructure for builders
        </p>
      </div>

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
