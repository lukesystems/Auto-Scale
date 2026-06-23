import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Pain } from "@/components/landing/pain";
import { Loop } from "@/components/landing/loop";
import { How } from "@/components/landing/how";
import { Modules } from "@/components/landing/modules";
import { Differentiation } from "@/components/landing/differentiation";
import { Pricing } from "@/components/landing/pricing";
import { FAQ } from "@/components/landing/faq";
import { FinalCTA } from "@/components/landing/cta";
import { Footer } from "@/components/landing/footer";

export default function LandingPage() {
  return (
    <div className="relative min-h-screen flex flex-col bg-background">
      <LandingNav />
      <main className="flex-1">
        <Hero />
        <Pain />
        <Loop />
        <How />
        <Modules />
        <Differentiation />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
