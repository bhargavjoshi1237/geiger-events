"use client";

import React from "react";
import { Topbar as SuiteTopbar } from "@geiger/ui";
import { SidebarTrigger } from "@geiger/ui/sidebar";
import { NotificationsBell } from "./dialogue/notifications_bell";
import { ProfileDropdown } from "./dialogue/profile_dropdown";
import { SupabaseActivityLine } from "./supabase_activity_line";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useVisibleNav } from "@/lib/hooks/use-visible-nav";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

export function Topbar() {
  const { setTab } = useWorkspaceUrl();
  const visibleNav = useVisibleNav();

  return (
    <SuiteTopbar
      label="Events"
      logoSrc={`${BASE_PATH}/logo1.svg`}
      homeHref={BASE_PATH || "/"}
      helpHref="/docs"
      searchPlaceholder="Search Events..."
      searchNav={visibleNav}
      searchRecentsKey="geiger:events:search-recents"
      onSearchSelect={(item) => setTab(item.title)}
      sidebarTrigger={
        <SidebarTrigger className="md:hidden -ml-2 text-foreground" />
      }
      notifications={<NotificationsBell />}
      profile={<ProfileDropdown />}
      activity={<SupabaseActivityLine />}
    />
  );
}
