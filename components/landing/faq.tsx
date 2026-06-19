"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Is this just another AI content generator?",
    a: "No. AI content generators give you disconnected text. AutoScale protects a chain: product context → market evidence → insight → hook → experiment → metric → learning → variant. The point is not more content. The point is better tests.",
  },
  {
    q: "What happens after I paste my startup URL?",
    a: "AutoBrief reads your product page, creates a structured product brief, and saves it as project memory. From there, the Competitor Intelligence Engine uses that context to map relevant market patterns before content is generated.",
  },
  {
    q: "Why competitor intelligence instead of a normal content calendar?",
    a: "Calendars create activity. Intelligence creates leverage. AutoScale studies public patterns around your niche, then turns the useful ones into experiments with hypotheses and metrics.",
  },
  {
    q: "Does AutoScale automatically pull from every social platform?",
    a: "Not blindly. The system is designed around public and permitted sources, manual source input, imports, and provider-backed adapters where available. Platform-specific automation should be added carefully, not hacked in a brittle way.",
  },
  {
    q: "Does AutoScale post for me automatically?",
    a: "Not blindly. V1 supports approved-content scheduling through Postiz and manual exports. Full autonomy comes later, after enough project data proves the loop. Autonomy is earned by evidence.",
  },
  {
    q: "What about my existing tools?",
    a: "AutoScale is the intelligence layer above your scheduler. It decides what to test, why, and what to learn. Postiz handles publishing. You can also export ZIP packs for manual posting anywhere.",
  },
  {
    q: "Can I use my own AI provider?",
    a: "Yes. AutoScale uses a model abstraction layer across supported providers and OpenRouter-style routing. Configure once in settings. You should not be locked to one model.",
  },
  {
    q: "What does the current V1 include?",
    a: "Real Supabase auth + RLS, projects, AutoBrief, product brief memory, competitor/source input, TrendWatch with signal scoring, hook + idea + post generation, Quality Gate, approval queue, ZIP exports, basic Postiz scheduling, manual experiment tracker, and winner-to-variants.",
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
