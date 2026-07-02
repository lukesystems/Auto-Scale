"use client";

import { useState } from "react";
import { ChevronRight, GitBranch, X } from "lucide-react";
import { Button } from "@/components/ui/button";

export type EvidenceEntityType = "video" | "trendhop" | "experiment" | "winner";

export interface EvidenceLink {
  label: string;
  detail?: string | null;
  href?: string | null;
}

export interface EvidenceChain {
  source?: EvidenceLink | null;
  insight?: EvidenceLink | null;
  hook?: EvidenceLink | null;
  concept?: EvidenceLink | null;
  post?: EvidenceLink | null;
  schedule?: EvidenceLink | null;
  experiment?: EvidenceLink | null;
  winner?: EvidenceLink | null;
  variant?: EvidenceLink | null;
}

interface EvidenceChainDrawerProps {
  entityType: EvidenceEntityType;
  entityId: string;
  chain: EvidenceChain;
  triggerLabel?: string;
}

/**
 * Minimal evidence-chain side drawer. Mount on cards (video, trendhop) and
 * pass the pre-resolved chain — server components fetch the chain links from
 * the existing FKs (source → insight → hook → concept → post → schedule →
 * experiment → winner → variant) and hand the labels in.
 *
 * Pivot note: this is the v1 of the drawer. A future iteration should lazy-
 * load chain data via a server action keyed on entityType + entityId so the
 * card doesn't have to fetch up front.
 */
export function EvidenceChainDrawer({
  entityType,
  entityId,
  chain,
  triggerLabel,
}: EvidenceChainDrawerProps) {
  const [open, setOpen] = useState(false);

  const entries = (
    [
      ["source", chain.source],
      ["insight", chain.insight],
      ["hook", chain.hook],
      ["concept", chain.concept],
      ["post", chain.post],
      ["schedule", chain.schedule],
      ["experiment", chain.experiment],
      ["winner", chain.winner],
      ["variant", chain.variant],
    ] as Array<[string, EvidenceLink | null | undefined]>
  ).filter(([, v]) => v && v.label);

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        onClick={() => setOpen(true)}
        title={`Evidence chain for ${entityType}`}
      >
        <GitBranch className="h-3.5 w-3.5" />
        {triggerLabel ?? "Evidence"}
      </Button>

      {open && (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur"
            onClick={() => setOpen(false)}
          />
          <aside className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto border-l border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-4">
              <div>
                <p className="text-xs uppercase tracking-wider text-muted-foreground">
                  Evidence chain
                </p>
                <p className="font-semibold capitalize">{entityType}</p>
                <p className="text-xs text-muted-foreground">{entityId.slice(0, 8)}…</p>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="p-4">
              {entries.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  No upstream evidence linked yet for this {entityType}.
                </p>
              ) : (
                <ol className="space-y-2">
                  {entries.map(([stage, link], i) => (
                    <li
                      key={stage}
                      className="rounded-md border border-border bg-card p-3"
                    >
                      <div className="flex items-center gap-2 text-[10px] uppercase tracking-wider text-muted-foreground">
                        <span>step {i + 1}</span>
                        <ChevronRight className="h-3 w-3" />
                        <span>{stage}</span>
                      </div>
                      <p className="mt-1 text-sm font-medium">{link?.label}</p>
                      {link?.detail && (
                        <p className="mt-0.5 text-xs text-muted-foreground">{link.detail}</p>
                      )}
                      {link?.href && (
                        <a
                          href={link.href}
                          className="mt-1 inline-block text-xs text-primary hover:underline"
                        >
                          Open
                        </a>
                      )}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </aside>
        </div>
      )}
    </>
  );
}
