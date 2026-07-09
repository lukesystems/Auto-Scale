"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Rocket,
  TrendingUp,
  Trophy,
  GitBranch,
  Lightbulb,
  Menu,
  X,
  ChevronDown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { type PipelineStep } from "@/lib/project-pipeline";
import { useState } from "react";

interface ProjectNavProps {
  projectId: string;
  pipeline?: PipelineStep[];
  activeRunId?: string | null;
}

type NavItem = {
  key: string;
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

type NavGroup = {
  id: string;
  label: string;
  items: NavItem[];
};

function buildGroups(activeRunId?: string | null): NavGroup[] {
  const runHref = activeRunId ? `/growth/${activeRunId}` : "/growth";
  return [
    {
      id: "overview",
      label: "Overview",
      items: [
        { key: "overview", href: "", label: "Overview", icon: LayoutDashboard },
        { key: "runs", href: "/runs", label: "Run Center", icon: GitBranch },
      ],
    },
    {
      id: "autoscale",
      label: "AutoScale Shorts",
      items: [
        { key: "growth", href: runHref, label: "Active Run", icon: Rocket },
        { key: "growth-results", href: "/growth/results", label: "Growth Graph", icon: TrendingUp },
        { key: "winners", href: "/growth/winners", label: "Winners", icon: Trophy },
        { key: "daily-growth", href: "/growth/daily", label: "Daily Pack", icon: Rocket },
      ],
    },
    {
      id: "library",
      label: "Library",
      items: [
        { key: "variants", href: "/growth/variants", label: "Variants", icon: GitBranch },
        { key: "learnings", href: "/growth/learnings", label: "Learnings", icon: Lightbulb },
      ],
    },
  ];
}

export function ProjectNav({
  projectId,
  pipeline = [],
  activeRunId,
}: ProjectNavProps) {
  const pathname = usePathname();
  const base = `/projects/${projectId}`;
  const GROUPS = buildGroups(activeRunId);
  const doneKeys = new Set(pipeline.filter((s) => s.done).map((s) => s.key));
  const [mobileOpen, setMobileOpen] = useState(false);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const pipelineKeys = new Set(pipeline.map((s) => s.key));
  const doneCount = pipeline.filter((s) => s.done).length;
  const total = pipeline.length || 1;
  const progress = Math.round((doneCount / total) * 100);

  function toggleGroup(id: string) {
    setCollapsedGroups((s) => ({ ...s, [id]: !s[id] }));
  }

  const sidebar = (
    <aside className="flex h-full w-full flex-col gap-1 border-r border-border bg-card/40 p-3 lg:w-60 lg:min-w-60">
      <div className="px-1 pb-3">
        <div className="h-1 w-full overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-muted-foreground">
          {doneCount}/{total} pipeline steps
        </p>
      </div>

      {GROUPS.map((group) => {
        const collapsed = collapsedGroups[group.id];
        return (
          <div key={group.id} className="space-y-0.5">
            <button
              type="button"
              onClick={() => toggleGroup(group.id)}
              className="flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground hover:bg-secondary/50"
            >
              <span>{group.label}</span>
              <ChevronDown
                className={cn(
                  "h-3 w-3 transition-transform",
                  collapsed && "-rotate-90"
                )}
              />
            </button>
            {!collapsed &&
              group.items.map((item) => {
                const href = item.href ? `${base}${item.href}` : base;
                const isActive =
                  item.href === ""
                    ? pathname === base
                    : pathname === href || pathname.startsWith(href + "/");
                const done = pipelineKeys.has(item.key) && doneKeys.has(item.key);
                return (
                  <Link
                    key={`${group.id}:${item.key}`}
                    href={href}
                    onClick={() => setMobileOpen(false)}
                    className={cn(
                      "relative flex items-center gap-2 rounded-md px-2.5 py-1.5 text-sm font-medium transition-colors",
                      isActive
                        ? "bg-foreground text-background"
                        : done
                          ? "text-foreground/85 hover:bg-secondary"
                          : "text-muted-foreground hover:bg-secondary/80 hover:text-foreground"
                    )}
                  >
                    <item.icon className="h-4 w-4 shrink-0" />
                    <span className="truncate">{item.label}</span>
                    {done && !isActive && (
                      <span className="ml-auto h-1.5 w-1.5 rounded-full bg-primary" />
                    )}
                  </Link>
                );
              })}
          </div>
        );
      })}
    </aside>
  );

  return (
    <>
      <div className="sticky top-14 z-30 flex items-center gap-2 border-b border-border bg-background/90 px-4 py-2 backdrop-blur lg:hidden">
        <button
          type="button"
          onClick={() => setMobileOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-md border border-border bg-background px-3 text-sm"
        >
          <Menu className="h-4 w-4" /> Menu
        </button>
        <div className="h-1 flex-1 overflow-hidden rounded-full bg-secondary">
          <div
            className="h-full rounded-full bg-primary transition-all duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {mobileOpen && (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div
            className="absolute inset-0 bg-background/70 backdrop-blur"
            onClick={() => setMobileOpen(false)}
          />
          <div className="absolute inset-y-0 left-0 w-72 max-w-[85vw] overflow-y-auto border-r border-border bg-background shadow-xl">
            <div className="flex items-center justify-between border-b border-border p-3">
              <span className="text-sm font-semibold">Navigation</span>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                className="rounded-md p-1.5 hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            {sidebar}
          </div>
        </div>
      )}

      <div className="sticky top-14 z-20 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto lg:block">
        {sidebar}
      </div>
    </>
  );
}
