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
            Ready to stop guessing?{" "}
            <span className="text-gradient bg-[length:200%_auto] animate-gradient-shift">
              Run the loop.
            </span>
          </h2>
          <p className="mt-6 text-base md:text-lg text-muted-foreground text-balance max-w-2xl mx-auto">
            Paste your product URL and let AutoScale build your first short-form video growth loop.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row gap-3 items-center justify-center">
            <Button asChild size="xl" variant="glow">
              <Link href="/auth/sign-up">
                Find My Winning Format
                <ArrowRight className="h-4 w-4" />
              </Link>
            </Button>
            <Button asChild size="xl" variant="outline">
              <Link href="/auth/sign-in">I already have an account</Link>
            </Button>
          </div>

          <p className="mt-6 text-sm font-medium text-foreground/75">
            Find what works <span className="mx-1.5 text-primary">→</span> Ship videos{" "}
            <span className="mx-1.5 text-primary">→</span> Compound your winners
          </p>
        </div>
      </div>
    </section>
  );
}
