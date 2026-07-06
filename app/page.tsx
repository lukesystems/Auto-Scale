import { LandingNav } from "@/components/landing/nav";
import { Hero } from "@/components/landing/hero";
import { Pain } from "@/components/landing/pain";
import { EvidenceChain } from "@/components/landing/evidence-chain";
import { Loop } from "@/components/landing/loop";
import { How } from "@/components/landing/how";
import { Modules } from "@/components/landing/modules";
import { Differentiation } from "@/components/landing/differentiation";
import { Comparison } from "@/components/landing/comparison";
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
        <EvidenceChain />
        <Loop />
        <How />
        <Modules />
        <Differentiation />
        <Comparison />
        <Pricing />
        <FAQ />
        <FinalCTA />
      </main>
      <Footer />
    </div>
  );
}
