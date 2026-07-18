"use client";

import React from "react";
import { Bell } from "lucide-react";
import { Topbar as SuiteTopbar } from "@geiger/ui";
import { Button } from "@/components/ui/button";
import { SidebarTrigger } from "@/components/ui/sidebar";
import { NotificationsDropdown } from "./dialogue/notifications_dropdown";
import { ProfileDropdown } from "./dialogue/profile_dropdown";
import { SupabaseActivityLine } from "./supabase_activity_line";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";

// Suite topbar from @geiger/ui, wired with this product's name + data-bound slots.
export function Topbar() {
  return (
    <SuiteTopbar
      label="Events"
      logoSrc={`${BASE_PATH}/logo1.svg`}
      homeHref={BASE_PATH || "/"}
      helpHref="/docs"
      sidebarTrigger={
        <SidebarTrigger className="md:hidden -ml-2 text-foreground" />
      }
      notifications={
        <NotificationsDropdown>
          <Button
            variant="ghost"
            size="icon-sm"
            aria-label="Notifications"
            className="w-8 h-8 rounded-full border border-transparent hover:bg-surface-hover hidden items-center justify-center transition-colors text-muted-foreground hover:text-foreground relative sm:flex"
          >
            <Bell className="w-[18px] h-[18px]" strokeWidth={2} />
          </Button>
        </NotificationsDropdown>
      }
      profile={<ProfileDropdown />}
      activity={<SupabaseActivityLine />}
    />
  );
}
