"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  FileText,
  Brain,
  Lightbulb,
  Layers,
  Shield,
  Package,
  Send,
  FlaskConical,
  Trophy,
  Network,
  Video,
  Sparkles,
  TrendingUp,
  Rocket,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PipelineStep } from "@/lib/project-pipeline";

interface ProjectNavProps {
  projectId: string;
  pipeline?: PipelineStep[];
}

const NAV_ITEMS = [
  { key: "overview", href: "", label: "Overview", icon: LayoutDashboard, step: 0 },
  { key: "growth", href: "/growth", label: "Growth Run", icon: Rocket, step: 0 },
  { key: "daily-growth", href: "/growth/daily", label: "Daily Pack", icon: Package, step: 0 },
  { key: "growth-results", href: "/growth/results", label: "Growth Graph", icon: TrendingUp, step: 0 },
  { key: "brief", href: "/brief", label: "Brief", icon: FileText, step: 1 },
  { key: "sources", href: "/sources", label: "Sources", icon: Network, step: 2 },
  { key: "video-intelligence", href: "/video-intelligence", label: "Video", icon: Video, step: 3 },
  { key: "patterns", href: "/patterns", label: "Patterns", icon: Sparkles, step: 4 },
  { key: "signals", href: "/signals", label: "Signals", icon: TrendingUp, step: 5 },
  { key: "trendwatch", href: "/trendwatch", label: "TrendWatch", icon: Brain, step: 6 },
  { key: "ideas", href: "/ideas", label: "Ideas", icon: Lightbulb, step: 7 },
  { key: "content", href: "/content", label: "Content", icon: Layers, step: 8 },
  { key: "approval", href: "/approval", label: "Approval", icon: Shield, step: 9 },
  { key: "exports", href: "/exports", label: "Exports", icon: Package, step: 10 },
  { key: "schedule", href: "/schedule", label: "Schedule", icon: Send, step: 11 },
  { key: "experiments", href: "/experiments", label: "Experiments", icon: FlaskConical, step: 12 },
  { key: "winners", href: "/winners", label: "Winners", icon: Trophy, step: 13 },
] as const;

export function ProjectNav({ projectId, pipeline = [] }: ProjectNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const doneKeys = new Set(pipeline.filter((s) => s.done).map((s) => s.key));
  const completedCount = NAV_ITEMS.slice(1).filter((item) => doneKeys.has(item.key)).length;
  const progress = Math.round((completedCount / (NAV_ITEMS.length - 1)) * 100);

  return (
    <div className="sticky top-14 z-30 border-b border-border bg-background/90 shadow-[0_10px_30px_-28px_rgba(15,23,42,0.7)] backdrop-blur-xl backdrop-saturate-150">
      <div className="container py-2">
        <div className="flex items-center gap-3 px-1 pb-2">
          <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
            <div
              className="h-full rounded-full bg-primary transition-all duration-500"
              style={{ width: `${progress}%` }}
            />
          </div>
          <span className="hidden text-[11px] font-medium text-muted-foreground sm:inline">
            {completedCount}/{NAV_ITEMS.length - 1} complete
          </span>
        </div>

        <nav className="-mx-1 flex items-center gap-1 overflow-x-auto px-1 pb-1 scrollbar-thin">
          {NAV_ITEMS.map((item) => {
            const href = item.href ? `${base}${item.href}` : base;
            const isActive = item.href === "" ? pathname === base : pathname.startsWith(href);
            const done = doneKeys.has(item.key);

            return (
              <Link
                key={item.href || "overview"}
                href={href}
                className={cn(
                  "relative inline-flex h-9 items-center gap-1.5 whitespace-nowrap rounded-lg px-3 text-sm font-medium transition-all duration-200",
                  isActive
                    ? "bg-foreground text-background shadow-sm"
                    : done
                      ? "text-foreground/80 hover:bg-secondary hover:text-foreground"
                      : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                )}
              >
                <item.icon className={cn("h-4 w-4 shrink-0", isActive && "text-background")} />
                <span className="hidden sm:inline">{item.label}</span>
                {done && !isActive && (
                  <span className="absolute right-1 top-1 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}


