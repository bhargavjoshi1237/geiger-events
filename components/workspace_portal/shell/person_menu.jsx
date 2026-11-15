"use client";

import { ChevronsUpDown, LogOut, Moon, Sun } from "lucide-react";
import {
  Avatar, AvatarFallback, Badge, DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger,
  SidebarMenu, SidebarMenuButton, SidebarMenuItem,
} from "@geiger/ui";
import { usePortalApp } from "./portal_app";

const initials = (text) => String(text || "?").split(/[\s@.]+/).filter(Boolean).slice(0, 2).map((part) => part[0]?.toUpperCase()).join("") || "?";

// The signed-in person: their name, roles, light/dark and sign out.
export function PersonMenu({ variant = "sidebar" }) {
  const { session, mode, toggleMode, signOut } = usePortalApp();
  const member = session?.member;
  const name = session?.person?.name || member?.name || member?.email?.split("@")[0] || "You";
  const avatar = (
    <Avatar className="size-8">
      <AvatarFallback className="text-xs font-semibold text-foreground">{initials(name)}</AvatarFallback>
    </Avatar>
  );
  const menu = (
    <DropdownMenuContent align={variant === "sidebar" ? "start" : "end"} side={variant === "sidebar" ? "top" : "bottom"} className="w-64">
      <DropdownMenuLabel className="grid gap-0.5 font-normal">
        <span className="truncate text-sm font-medium text-foreground">{name}</span>
        <span className="truncate text-xs text-text-tertiary">{member?.email}</span>
        {session?.roles?.length ? (
          <span className="mt-1.5 flex flex-wrap gap-1">
            {session.roles.map((role) => <Badge key={role.id} variant="outline" className="text-[11px]">{role.name}</Badge>)}
          </span>
        ) : null}
      </DropdownMenuLabel>
      <DropdownMenuSeparator />
      <DropdownMenuItem onSelect={toggleMode}>
        {mode === "light" ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}{mode === "light" ? "Dark mode" : "Light mode"}
      </DropdownMenuItem>
      <DropdownMenuItem onSelect={signOut}><LogOut className="h-4 w-4" />Sign out</DropdownMenuItem>
    </DropdownMenuContent>
  );

  if (variant !== "sidebar") {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild><button type="button" aria-label="Account" className="rounded-full">{avatar}</button></DropdownMenuTrigger>
        {menu}
      </DropdownMenu>
    );
  }
  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton size="lg" className="data-[state=open]:bg-sidebar-accent">
              {avatar}
              <span className="grid min-w-0 flex-1 text-left leading-tight">
                <span className="truncate text-sm font-medium text-foreground">{name}</span>
                <span className="truncate text-xs text-text-tertiary">{member?.email}</span>
              </span>
              <ChevronsUpDown className="ml-auto text-text-tertiary" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          {menu}
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
