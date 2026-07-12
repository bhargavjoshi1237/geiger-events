"use client";

import React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Bell, LogOut, Sun, Moon, CircleUserRound, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { initials } from "./portal_kit";

const surfaceStyle = {
  backgroundColor: "var(--surface-dialog)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};
const itemStyle =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm cursor-default transition-colors outline-none hover:bg-surface-active focus:bg-surface-active text-muted-foreground hover:text-foreground focus:text-foreground";

function AccountMenu({ member, onNavigate, onSignOut }) {
  const { theme, setTheme } = useTheme();
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="ghost"
          size="icon-sm"
          className="ml-1 overflow-hidden rounded-full border border-border p-0 transition-colors hover:border-border-strong"
          aria-label="Account menu"
        >
          <Avatar className="size-full">
            <AvatarFallback className="border-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-[10px] font-semibold text-white">
              {initials(member?.name, member?.email)}
            </AvatarFallback>
          </Avatar>
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent
        className="w-72 rounded-xl border p-0 shadow-xl"
        style={surfaceStyle}
        sideOffset={8}
        align="end"
      >
        <div className="p-4 pb-3">
          <DropdownMenuLabel className="p-0">
            <div className="flex items-center gap-3">
              <Avatar className="size-10 border border-border">
                <AvatarFallback className="border-0 bg-gradient-to-br from-indigo-500 via-purple-500 to-pink-500 text-xs font-semibold text-white">
                  {initials(member?.name, member?.email)}
                </AvatarFallback>
              </Avatar>
              <div className="flex min-w-0 flex-1 flex-col">
                <span className="truncate text-sm font-semibold text-foreground">
                  {member?.name || "Your account"}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {member?.email}
                </span>
              </div>
            </div>
          </DropdownMenuLabel>
        </div>

        <DropdownMenuSeparator className="mx-0 bg-surface-hover" />

        <div className="p-1.5">
          <DropdownMenuGroup>
            <DropdownMenuItem className={itemStyle} onSelect={() => onNavigate("account")}>
              <CircleUserRound className="size-4 text-muted-foreground" />
              <span>Account settings</span>
            </DropdownMenuItem>
            <DropdownMenuItem className={itemStyle} onSelect={() => onNavigate("messages")}>
              <LifeBuoy className="size-4 text-muted-foreground" />
              <span>Contact an organiser</span>
            </DropdownMenuItem>
          </DropdownMenuGroup>

          <DropdownMenuSeparator className="my-1 bg-surface-hover" />

          <DropdownMenuItem className="cursor-default p-2 hover:bg-transparent focus:bg-transparent">
            <ToggleGroup
              type="single"
              value={theme}
              onValueChange={(v) => v && setTheme(v)}
              className="flex w-full items-center justify-evenly rounded-lg bg-background p-0.5"
            >
              <ToggleGroupItem
                value="light"
                className="h-7 flex-1 justify-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-surface-card hover:text-foreground data-[state=on]:bg-surface-active data-[state=on]:text-foreground"
              >
                <Sun className="size-3.5" /> Light
              </ToggleGroupItem>
              <ToggleGroupItem
                value="dark"
                className="h-7 flex-1 justify-center gap-1.5 rounded-md px-3 text-xs text-muted-foreground hover:bg-surface-card hover:text-foreground data-[state=on]:bg-surface-active data-[state=on]:text-foreground"
              >
                <Moon className="size-3.5" /> Dark
              </ToggleGroupItem>
            </ToggleGroup>
          </DropdownMenuItem>

          <DropdownMenuSeparator className="my-1 bg-surface-hover" />

          <DropdownMenuItem
            className={`${itemStyle} group hover:bg-destructive/10 hover:text-destructive focus:bg-destructive/10 focus:text-destructive`}
            onSelect={onSignOut}
          >
            <LogOut className="size-4 group-hover:text-red-400" />
            <span>Sign out</span>
          </DropdownMenuItem>
        </div>

        <div className="border-t border-border px-4 py-2.5">
          <div className="flex items-center justify-between text-[11px] text-text-secondary">
            <span>Geiger Events</span>
            <span className="flex items-center gap-1">
              <span className="inline-block h-1.5 w-1.5 rounded-full bg-emerald-500" />
              Signed in
            </span>
          </div>
        </div>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function PortalTopbar({ member, basePath, unread = 0, onNavigate, onSignOut }) {
  return (
    <header className="relative z-20 flex h-14 w-full shrink-0 items-center justify-between border-b border-border bg-background px-4">
      <div className="flex items-center gap-2">
        <SidebarTrigger className="md:hidden" />
        <Image
          src={`${basePath}/logo1.svg`}
          alt="Geiger Events"
          width={20}
          height={20}
          className="geiger-logo"
          priority
        />
        <div className="flex items-center gap-2 border-border pl-1 md:border-l md:pl-2">
          <span className="text-sm font-semibold text-foreground">Geiger Events</span>
        </div>
      </div>

      <div className="flex items-center gap-1">
        <Button
          variant="ghost"
          size="icon-sm"
          onClick={() => onNavigate("notifications")}
          aria-label="Notifications"
          className="relative rounded-full border border-transparent text-muted-foreground hover:bg-surface-hover hover:text-foreground"
        >
          <Bell className="size-4" />
          {unread ? (
            <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-primary ring-2 ring-background" />
          ) : null}
        </Button>
        <AccountMenu member={member} onNavigate={onNavigate} onSignOut={onSignOut} />
      </div>
    </header>
  );
}

export default PortalTopbar;
