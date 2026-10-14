"use client";

import React, { useState } from "react";
import Link from "next/link";
import { SidebarTrigger } from "@geiger/ui/sidebar";
import { NotificationsBell } from "../dialogue/notifications_bell";
import { ProfileDropdown } from "../dialogue/profile_dropdown";
import { SupabaseActivityLine } from "../supabase_activity_line";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

function LogoMark({ className }) {
  const [failed, setFailed] = useState(false);

  if (failed) {
    return <div className="w-2 h-2 bg-foreground rounded-full" />;
  }
  return (
    <img
      src={`${BASE_PATH}/logo1.svg`}
      alt=""
      className={className}
      onError={() => setFailed(true)}
    />
  );
}

export function ProjectTopbar({ name = "Events" }) {
  return (
    <header className="relative h-14 px-4 flex items-center justify-between border-b border-border bg-topbar-bg text-foreground z-20 w-full shrink-0">
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <SidebarTrigger className="md:hidden -ml-2 text-foreground" />
          <Link
            href={BASE_PATH || "/"}
            aria-label="Home"
            className="hidden w-8 h-8 rounded items-center justify-center shrink-0 md:flex md:-ml-1.5 hover:bg-surface-active rounded-md p-1"
          >
            <LogoMark className="geiger-logo w-7 h-7 -mr-0.5" />
          </Link>
          <div className="hidden items-center gap-1 group sm:flex md:border-l md:border-border pl-2">
            <span className="text-foreground font-semibold text-sm ml-1 truncate max-w-[150px] md:max-w-xs">
              {name}
            </span>
          </div>
        </div>
      </div>

      <div className="pointer-events-none absolute left-1/2 top-1/2 flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 md:hidden">
        <LogoMark className="geiger-logo h-5 w-5" />
        <span className="text-sm font-semibold text-foreground">Events</span>
      </div>

      <div className="flex justify-between gap-4 md:gap-8 sm:mr-2">
        <div className="flex items-center gap-2 sm:gap-3">
          <div className="flex items-center gap-0 sm:gap-1 ml-auto sm:ml-1">
            <NotificationsBell />
            <ProfileDropdown />
          </div>
        </div>
      </div>
      <SupabaseActivityLine />
    </header>
  );
}
