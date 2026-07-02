import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";

export function FinalCTA() {
  return (
    <section className="py-20 md:py-32 border-t border-border/40 relative overflow-hidden">
      <div className="absolute inset-0 -z-10 gradient-mesh opacity-60" />
      <div className="absolute inset-0 -z-10 bg-dot opacity-30 [mask-image:radial-gradient(ellipse_at_center,black_30%,transparent_70%)]" />

      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <h2 className="font-display text-4xl md:text-6xl font-semibold tracking-tight text-balance leading-[0.95]">
            Paste your URL.{" "}
            <span className="text-gradient bg-[length:200%_auto] animate-gradient-shift">
              Ship your first Growth Run.
            </span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground text-balance max-w-2xl mx-auto">
            AutoScale reads your site, hops the trends that matter, and ships an exploration batch of short-form videos —
            so you can stop guessing what to post and start compounding what works.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Button asChild size="xl" variant="glow">
              <Link href="/auth/sign-up">
                Start your first Growth Run
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/auth/sign-in">I already have an account</Link>
            </Button>
          </div>

          <p className="mt-6 text-xs text-muted-foreground">
            14-day money back. Cancel anytime. No long-form onboarding — just a URL.
          </p>
        </div>
      </div>
    </section>
  );
}
