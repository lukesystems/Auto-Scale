import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { NextMove } from "@/lib/next-move";

interface NextMoveBannerProps {
  move: NextMove;
}

export function NextMoveBanner({ move }: NextMoveBannerProps) {
  if (move.kind === "noop") return null;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <p className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
          Recommended next
        </p>
        <p className="mt-1 font-medium">{move.label}</p>
        <p className="mt-0.5 text-sm text-muted-foreground">{move.description}</p>
      </div>
      <Button asChild variant="glow" className="shrink-0">
        <Link href={move.href}>
          {move.label}
          <ArrowRight className="h-4 w-4" />
        </Link>
      </Button>
    </div>
  );
}
