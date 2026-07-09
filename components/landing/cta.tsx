import Link from "next/link";
import { Button } from "@/components/ui/button";
import { UrlCta } from "@/components/landing/url-cta";

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
            Every week without a distribution loop is another week of guessing. AutoScale Shorts reads your site, hops the
            trends that matter, and ships an exploration batch — so you can start compounding what works.
          </p>

          <div className="mt-10 mx-auto max-w-xl">
            <UrlCta size="large" buttonLabel="Start your first Growth Run" />
          </div>

          <div className="mt-5">
            <Button asChild size="lg" variant="ghost">
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
