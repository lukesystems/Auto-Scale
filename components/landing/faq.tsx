"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

const FAQS_BEFORE = [
  {
    q: "Does AutoScale actually post the videos?",
    a: "Yes. Approved videos can be scheduled and posted through Post Bridge to your connected TikTok, YouTube Shorts, and Instagram Reels accounts.",
  },
  {
    q: "What if my first batch flops?",
    a: "That's expected — and it's the whole point of the exploration batch. AutoScale's classifier turns flat or failing videos into learnings, while winners get compounded into variant batches. The system is designed to learn from failure, not be defeated by it.",
  },
  {
    q: "How is this different from ChatGPT + CapCut?",
    a: "Generic video tools start with a blank prompt and stop at an output. AutoScale starts with your product and today's trends, runs videos as experiments, measures what worked, and compounds the winners. It's a growth engine, not a generator.",
  },
  {
    q: "Is this spammy autopilot?",
    a: "No. Approval gates pause runs until you continue — auto, at critical stages, or at every stage. You control what ships. Nothing posts without your policy allowing it.",
  },
];

const FAQS_AFTER = [
  {
    q: "Do I need to be on camera?",
    a: "No. AutoScale supports multiple production modes — including reference-remix and trend-style videos that don't require your face. Founder-POV is an option, not a requirement.",
  },
  {
    q: "How does it know what's trending?",
    a: "TrendWatch pulls from public platform trend signals across TikTok, YouTube Shorts, and Instagram Reels, then proposes specific trend-hop angles tied to your product. It can run on demand or refresh on a 3, 7, or 14-day schedule.",
  },
  {
    q: "What metrics do you track?",
    a: "Save rate, views, clicks, and signups — tied back to each video's evidence chain. The Growth Graph shows which formats compound and which to kill.",
  },
  {
    q: "What happens after I paste my product URL?",
    a: "An LLM-driven crawl reads your site, features, pricing, and audience and writes a structured Product Brief. That brief is the source of truth every Growth Run, TrendWatch refresh, and variant batch is grounded in.",
  },
  {
    q: "Can I use my own AI provider?",
    a: "Yes. AutoScale uses a model abstraction across supported providers and OpenRouter-style routing. Configure once in settings — you should never be locked to one model.",
  },
  {
    q: "What about LinkedIn carousels or X threads?",
    a: "Deprecated. AutoScale used to ship a text/carousel content loop and we cut it. Short-form video is where founder distribution lives right now, and we'd rather build one engine extremely well than five mediocre ones.",
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

        <div className="mt-12 mx-auto max-w-5xl grid gap-8 lg:grid-cols-2">
          <FaqColumn
            title="Before you sign up"
            items={FAQS_BEFORE}
            open={open}
            setOpen={setOpen}
            offset={0}
          />
          <FaqColumn
            title="After your first run"
            items={FAQS_AFTER}
            open={open}
            setOpen={setOpen}
            offset={FAQS_BEFORE.length}
          />
        </div>
      </div>
    </section>
  );
}

function FaqColumn({
  title,
  items,
  open,
  setOpen,
  offset,
}: {
  title: string;
  items: { q: string; a: string }[];
  open: number | null;
  setOpen: (v: number | null) => void;
  offset: number;
}) {
  return (
    <div>
      <h3 className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-muted-foreground">{title}</h3>
      <div className="divide-y divide-border border border-border rounded-xl bg-card">
        {items.map((item, i) => {
          const index = offset + i;
          return (
            <div key={item.q}>
              <button
                type="button"
                onClick={() => setOpen(open === index ? null : index)}
                className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-secondary/50 transition-colors"
                aria-expanded={open === index}
              >
                <span className="text-sm font-semibold text-foreground">{item.q}</span>
                <ChevronDown
                  className={cn("h-4 w-4 text-muted-foreground transition-transform shrink-0", open === index && "rotate-180")}
                />
              </button>
              {open === index && (
                <div className="px-5 pb-4 text-sm text-muted-foreground leading-relaxed animate-fade-in">
                  {item.a}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
