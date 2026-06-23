"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS = [
  {
    q: "Is this just another AI video generator?",
    a: "No. Generic generators start with a prompt and stop at an output. AutoScale starts with your product URL, studies proven video patterns, creates trend-backed experiments, tracks what brings users, and compounds the winners.",
  },
  {
    q: "What happens after I paste my startup URL?",
    a: "AutoBrief reads your product page, creates a structured product brief, and saves it as project memory. VideoTrend then uses that context to map relevant hooks, formats, audience language, and gaps before videos are generated.",
  },
  {
    q: "Why trend intelligence instead of a normal content calendar?",
    a: "Calendars organize activity. AutoScale studies public video patterns around your niche, turns the useful ones into experiments, and learns which videos bring users.",
  },
  {
    q: "Does AutoScale automatically pull from every social platform?",
    a: "Not blindly. The system is designed around public and permitted sources, manual source input, imports, and provider-backed adapters where available. Platform-specific automation should be added carefully, not hacked in a brittle way.",
  },
  {
    q: "Does AutoScale post for me automatically?",
    a: "Not blindly. Approved videos can be scheduled through Postiz or exported for manual posting. Autopilot remains an explicit opt-in and should only act inside the founder's approval, cadence, quality, and account-safety rules.",
  },
  {
    q: "What about my existing tools?",
    a: "AutoScale is the strategy and learning layer above your scheduler. It decides which video experiments to test and what to compound. Postiz handles publishing, with ZIP export as the fallback.",
  },
  {
    q: "Can I use my own AI provider?",
    a: "Yes. AutoScale uses a model abstraction layer across supported providers and OpenRouter-style routing. Configure once in settings. You should not be locked to one model.",
  },
  {
    q: "What does the current product include?",
    a: "The current spine covers Product Brief, video evidence and pattern mining, VideoTrend strategy, scripts and storyboards, video assembly, approval, Postiz scheduling, tracked events, manual metrics, and winner classification. Provider quality and live account configuration still determine what can run end to end.",
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
