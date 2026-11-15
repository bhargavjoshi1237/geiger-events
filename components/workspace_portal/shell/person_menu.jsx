"use client";

import { ChevronsUpDown, LogOut, Moon, Sun } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
} from "@geiger/ui";
import { cn } from "@/lib/utils";
import { usePortalApp } from "./portal_app";

const initials = (text) => String(text || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

// The signed-in person: their name, roles, light/dark and sign out.
export function PersonMenu({ variant = "sidebar" }) {
  const { session, mode, toggleMode, signOut } = usePortalApp();
  const member = session?.member;
  const name = session?.person?.name || member?.name || member?.email?.split("@")[0] || "You";
  const avatar = (
    <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-surface-active text-xs font-semibold text-foreground">{initials(name)}</span>
  );
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "sidebar" ? (
          <button type="button" className="flex w-full min-w-0 items-center gap-2.5 rounded-md p-1.5 text-left hover:bg-surface-hover">
            {avatar}
            <span className="min-w-0 flex-1">
              <span className="block truncate text-sm font-medium text-foreground">{name}</span>
              <span className="block truncate text-xs text-text-tertiary">{member?.email}</span>
            </span>
            <ChevronsUpDown className="h-4 w-4 shrink-0 text-text-tertiary" />
          </button>
        ) : (
          <button type="button" aria-label="Account" className="rounded-full">{avatar}</button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-64">
        <DropdownMenuLabel className="grid gap-0.5 font-normal">
          <span className="truncate text-sm font-medium text-foreground">{name}</span>
          <span className="truncate text-xs text-text-tertiary">{member?.email}</span>
          {session?.roles?.length ? (
            <span className="mt-1.5 flex flex-wrap gap-1">
              {session.roles.map((role) => (
                <span key={role.id} className={cn("rounded-md border border-border px-1.5 py-0.5 text-[11px] text-text-secondary")}>{role.name}</span>
              ))}
            </span>
          ) : null}
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={toggleMode}>
          {mode === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}{mode === "light" ? "Dark mode" : "Light mode"}
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={signOut}><LogOut className="h-4 w-4" />Sign out</DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
