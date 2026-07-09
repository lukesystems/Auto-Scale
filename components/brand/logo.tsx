import { cn } from "@/lib/utils";
import Link from "next/link";

interface LogoProps {
  className?: string;
  showWordmark?: boolean;
  href?: string;
  size?: "sm" | "md" | "lg";
}

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 32 32"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("h-8 w-8", className)}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="autoscale-grad" x1="0" y1="0" x2="32" y2="32" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="hsl(158 84% 45%)" />
          <stop offset="100%" stopColor="hsl(158 84% 30%)" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx="8" fill="url(#autoscale-grad)" />
      <path
        d="M8 22L13 12L16 18L19 14L24 22"
        stroke="white"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <circle cx="24" cy="22" r="1.6" fill="white" />
      <circle cx="13" cy="12" r="1.6" fill="white" />
    </svg>
  );
}

export function Logo({ className, showWordmark = true, href = "/", size = "md" }: LogoProps) {
  const markSize = size === "sm" ? "h-7 w-7" : size === "lg" ? "h-10 w-10" : "h-8 w-8";
  const textSize = size === "sm" ? "text-base" : size === "lg" ? "text-2xl" : "text-lg";

  const content = (
    <span className={cn("inline-flex items-center gap-2 font-semibold tracking-tight", className)}>
      <LogoMark className={markSize} />
      {showWordmark && (
        <span className={cn("font-display", textSize)}>
          AutoScale<span className="text-primary">Shorts</span>
        </span>
      )}
    </span>
  );

  if (!href) return content;
  return (
    <Link href={href} className="inline-flex items-center gap-2 hover:opacity-90 transition-opacity">
      {content}
    </Link>
  );
}
