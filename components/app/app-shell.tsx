"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Logo } from "@/components/brand/logo";
import { UserMenu } from "./user-menu";
import type { User } from "@supabase/supabase-js";
import { ConfigBanner } from "./config-banner";
import { cn } from "@/lib/utils";

interface AppShellProps {
  user: User;
  displayName?: string | null;
  children: React.ReactNode;
  configured?: boolean;
}

export function AppShell({ user, displayName, children, configured = true }: AppShellProps) {
  const pathname = usePathname();

  return (
    <div className="min-h-screen flex flex-col bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-background/80 backdrop-blur-xl backdrop-saturate-150">
        <div className="container flex h-14 items-center justify-between">
          <div className="flex items-center gap-6">
            <Logo href="/projects" />
            <nav className="hidden md:flex items-center gap-0.5 text-sm">
              <NavLink href="/projects" active={pathname.startsWith("/projects")}>
                Projects
              </NavLink>
              <NavLink href="/settings" active={pathname.startsWith("/settings")}>
                Settings
              </NavLink>
            </nav>
          </div>
          <UserMenu email={user.email ?? ""} displayName={displayName ?? user.email ?? ""} />
        </div>
      </header>

      {!configured && <ConfigBanner />}

      <main className="flex-1">{children}</main>
    </div>
  );
}

function NavLink({
  href,
  children,
  active,
}: {
  href: string;
  children: React.ReactNode;
  active: boolean;
}) {
  return (
    <Link
      href={href}
      className={cn(
        "px-3 py-1.5 rounded-md font-medium transition-all duration-200",
        active
          ? "bg-primary/10 text-primary"
          : "text-muted-foreground hover:text-foreground hover:bg-secondary"
      )}
    >
      {children}
    </Link>
  );
}
