"use client";

import Link from "next/link";
import { LogOut, Settings, User as UserIcon, Bug } from "lucide-react";
import { signOutAction } from "@/app/auth/actions";
import { Button } from "@/components/ui/button";
import { getInitials } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function UserMenu({ email, displayName }: { email: string; displayName: string }) {
  const initials = getInitials(displayName || email);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="gap-2 pl-2 pr-3">
          <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-primary/15 text-primary text-xs font-semibold">
            {initials}
          </span>
          <span className="hidden md:inline text-sm">{displayName || email}</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="flex flex-col">
            <span className="font-semibold text-foreground">{displayName || email}</span>
            <span className="text-xs text-muted-foreground">{email}</span>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem asChild>
          <Link href="/settings"><Settings className="h-4 w-4" /> Settings</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/settings/publishing"><UserIcon className="h-4 w-4" /> Publishing connection</Link>
        </DropdownMenuItem>
        <DropdownMenuItem asChild>
          <Link href="/debug/ai-runs"><Bug className="h-4 w-4" /> AI runs (debug)</Link>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <form action={signOutAction}>
          <button
            type="submit"
            className="w-full flex items-center gap-2 px-2 py-1.5 text-sm rounded-md hover:bg-secondary text-left"
          >
            <LogOut className="h-4 w-4" /> Sign out
          </button>
        </form>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
