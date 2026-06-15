"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Isn't this just another AI content generator?",
    a: "No. AI content generators give you disconnected text. AutoScale protects a data chain: source → insight → hook → content idea → generated post → experiment → metric → learning → variant. Every artifact traces back to a real market signal and a testable hypothesis.",
  },
  {
    q: "I'm not a marketer. Will I get lost?",
    a: "AutoScale is built specifically for technical founders. You drop a product URL, add competitors, and run TrendWatch. The system tells you what to post, why, what hypothesis you're testing, and what to measure. No marketing instincts required.",
  },
  {
    q: "Why TrendWatch instead of scraping TikTok?",
    a: "Full social scraping is brittle and often violates platform rules. TrendWatch supports manual URLs, screenshots, CSV imports, and public metadata. Full scraping arrives in V2 through proper APIs. The intelligence layer matters more than the data pipe.",
  },
  {
    q: "Does AutoScale post for me automatically?",
    a: "Not blindly. V1 ships with basic Postiz scheduling for approved content — you decide what goes live. Fully autonomous posting arrives in V3, after enough project data proves the loop. Autonomy is earned by data.",
  },
  {
    q: "What about my existing tools?",
    a: "AutoScale is the intelligence layer above your scheduler. It decides what to post, why, and what to learn. Postiz handles publishing. You can also export ZIP packs for manual posting anywhere — Buffer, Hypefury, native, whatever.",
  },
  {
    q: "Can I use my own AI provider?",
    a: "Yes. AutoScale uses a model abstraction layer — OpenAI, Anthropic, Gemini, OpenRouter, or local. Configure once in /settings. You're never locked to a single provider.",
  },
  {
    q: "What does the V1 actually include?",
    a: "Real Supabase auth + RLS, projects, product brief, competitor & source input, TrendWatch with signal scoring, hook + content idea + post generation, Quality Gate, approval queue, ZIP exports, basic Postiz scheduling, manual experiment tracker, and winner-to-variants. Full SaaS foundation, focused loop.",
  },
];

export function FAQ() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section id="faq" className="py-20 md:py-28 border-t border-border/40 bg-secondary/30">
      <div className="container">
        <div className="mx-auto max-w-3xl text-center">
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-border bg-background text-xs font-medium text-muted-foreground">
            Common questions
          </div>
          <h2 className="mt-4 font-display text-3xl md:text-5xl font-semibold tracking-tight text-balance">
            Frequently asked.
          </h2>
        </div>

        <div className="mt-12 mx-auto max-w-3xl divide-y divide-border border border-border rounded-xl bg-card">
          {FAQS.map((item, i) => (
            <div key={i}>
              <button
                onClick={() => setOpen(open === i ? null : i)}
                className="w-full flex items-center justify-between gap-4 px-6 py-5 text-left hover:bg-secondary/50 transition-colors"
                aria-expanded={open === i}
              >
                <span className="font-semibold text-foreground">{item.q}</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open === i && "rotate-180")}
                />
              </button>
              {open === i && (
                <div className="px-6 pb-5 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                  {item.a}
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
