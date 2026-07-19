"use client";

import React from "react";
import Image from "next/image";
import { useTheme } from "next-themes";
import { Bell, LogOut, Sun, Moon, CircleUserRound, LifeBuoy } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
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
  backgroundColor: "var(--surface-subtle)",
  borderColor: "var(--border)",
  color: "var(--foreground)",
};
const itemStyle =
  "flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm cursor-default transition-colors outline-none hover:bg-surface-hover focus:bg-surface-hover text-muted-foreground hover:text-foreground focus:text-foreground";

function AccountMenu({ member, onNavigate, onSignOut }) {
  const { theme, setTheme } = useTheme();
  // Real profile photo if the member has one; Radix falls back to initials on 404.
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const pfpUrl =
    member?.metadata?.avatarUrl ||
    member?.metadata?.avatar ||
    (member?.id && supaUrl
      ? `${supaUrl}/storage/v1/object/public/pfp/${member.id}/latest.jpg`
      : null);
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
            {pfpUrl && <AvatarImage src={pfpUrl} alt={member?.name || "Member"} />}
            <AvatarFallback className="border-0 bg-surface-strong text-sm font-semibold text-foreground">
              {initials(member?.name, member?.email).charAt(0)}
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
                {pfpUrl && <AvatarImage src={pfpUrl} alt={member?.name || "Member"} />}
                <AvatarFallback className="border-0 bg-surface-strong text-base font-semibold text-foreground">
                  {initials(member?.name, member?.email).charAt(0)}
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
            className={`${itemStyle} group hover:bg-red-500/10 hover:text-red-400 focus:bg-red-500/10 focus:text-red-400`}
            onSelect={onSignOut}
          >
            <LogOut className="size-4 group-hover:text-red-400 group-focus:text-red-400" />
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
      {/* Brand — mirrors the shared @geiger/ui Topbar: logo in a sized link, then
          a wordmark separated by a border-l divider (desktop). */}
      <div className="flex items-center gap-1.5">
        <SidebarTrigger className="-ml-2 text-foreground md:hidden" />
        <a
          href={basePath || "/"}
          aria-label="Home"
          className="hidden h-8 w-8 shrink-0 items-center justify-center rounded transition-colors hover:bg-surface-active md:-ml-1.5 md:flex"
        >
          <Image
            src={`${basePath}/logo1.svg`}
            alt=""
            width={20}
            height={20}
            className="geiger-logo -mr-0.5 h-5 w-5"
            priority
          />
        </a>
        <div className="hidden items-center pl-2 md:flex md:border-l md:border-border">
          <span className="ml-1 text-sm font-semibold text-foreground">Geiger Events</span>
        </div>
      </div>

      {/* Mobile — centered logo + wordmark, matching the suite topbar. */}
      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 md:hidden">
        <Image
          src={`${basePath}/logo1.svg`}
          alt=""
          width={20}
          height={20}
          className="geiger-logo h-5 w-5"
        />
        <span className="text-sm font-semibold text-foreground">Geiger Events</span>
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
