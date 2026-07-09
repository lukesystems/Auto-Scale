import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

const DEFAULT_STEPS = [
  "Find what works",
  "Ship videos",
  "Track users",
  "Compound winners",
] as const;

export function GrowthLoop({
  className,
  compact = false,
  steps = DEFAULT_STEPS,
}: {
  className?: string;
  compact?: boolean;
  steps?: readonly string[];
}) {
  return (
    <ol
      aria-label="AutoScale Shorts growth loop"
      className={cn(
        "flex flex-col items-stretch gap-2 sm:flex-row sm:items-center sm:justify-center",
        className
      )}
    >
      {steps.map((step, index) => (
        <li key={step} className="contents">
          <span
            className={cn(
              "rounded-lg border border-border/70 bg-background/65 text-center font-medium text-foreground/85",
              compact ? "px-3 py-1.5 text-xs" : "px-4 py-2.5 text-sm"
            )}
          >
            {step}
          </span>
          {index < steps.length - 1 ? (
            <ArrowRight
              aria-hidden="true"
              className="mx-auto h-3.5 w-3.5 rotate-90 text-primary sm:rotate-0"
            />
          ) : null}
        </li>
      ))}
    </ol>
  );
}
