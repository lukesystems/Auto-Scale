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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PipelineStep } from "@/lib/project-pipeline";

interface ProjectNavProps {
  projectId: string;
  pipeline?: PipelineStep[];
}

const NAV_ITEMS = [
  { key: "overview", href: "", label: "Overview", icon: LayoutDashboard, step: 0 },
  { key: "brief", href: "/brief", label: "Brief", icon: FileText, step: 1 },
  { key: "sources", href: "/sources", label: "Sources", icon: Network, step: 2 },
  { key: "trendwatch", href: "/trendwatch", label: "TrendWatch", icon: Brain, step: 3 },
  { key: "ideas", href: "/ideas", label: "Ideas", icon: Lightbulb, step: 4 },
  { key: "content", href: "/content", label: "Content", icon: Layers, step: 5 },
  { key: "approval", href: "/approval", label: "Approval", icon: Shield, step: 6 },
  { key: "exports", href: "/exports", label: "Exports", icon: Package, step: 7 },
  { key: "schedule", href: "/schedule", label: "Schedule", icon: Send, step: 8 },
  { key: "experiments", href: "/experiments", label: "Experiments", icon: FlaskConical, step: 9 },
  { key: "winners", href: "/winners", label: "Winners", icon: Trophy, step: 10 },
] as const;

export function ProjectNav({ projectId, pipeline = [] }: ProjectNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const doneKeys = new Set(pipeline.filter((s) => s.done).map((s) => s.key));

  return (
    <div className="border-b border-border bg-background/95 backdrop-blur-sm sticky top-14 z-30">
      <div className="container">
        {/* Mini progress bar */}
        <div className="flex items-center gap-0.5 pt-2 pb-1 px-1">
          {NAV_ITEMS.slice(1).map((item, i) => {
            const done = doneKeys.has(item.key);
            const isLast = i === NAV_ITEMS.length - 2;
            return (
              <div key={item.key} className="flex items-center flex-1 min-w-0">
                <div
                  className={cn(
                    "h-0.5 flex-1 rounded-full transition-colors duration-500",
                    done ? "bg-primary" : "bg-border"
                  )}
                />
                {!isLast && <div className="w-0.5" />}
              </div>
            );
          })}
        </div>

        <nav className="flex items-center gap-0.5 overflow-x-auto py-2 scrollbar-thin -mx-1 px-1">
          {NAV_ITEMS.map((item) => {
            const href = item.href ? `${base}${item.href}` : base;
            const isActive = item.href === "" ? pathname === base : pathname.startsWith(href);
            const done = doneKeys.has(item.key);

            return (
              <Link
                key={item.href || "overview"}
                href={href}
                className={cn(
                  "relative inline-flex items-center gap-1.5 px-2.5 py-1.5 text-xs font-medium rounded-lg whitespace-nowrap transition-all duration-200",
                  isActive
                    ? "bg-primary text-primary-foreground shadow-sm shadow-primary/20"
                    : done
                      ? "text-foreground/80 hover:bg-secondary hover:text-foreground"
                      : "text-muted-foreground hover:text-foreground hover:bg-secondary/80"
                )}
              >
                <item.icon className={cn("h-3.5 w-3.5 shrink-0", isActive && "text-primary-foreground")} />
                <span className="hidden sm:inline">{item.label}</span>
                {done && !isActive && (
                  <span className="absolute -top-0.5 -right-0.5 h-1.5 w-1.5 rounded-full bg-primary ring-2 ring-background" />
                )}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}


