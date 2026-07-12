"use client";

import React from "react";
import Image from "next/image";
import {
  Home,
  Ticket,
  ShoppingBag,
  BadgeCheck,
  MessagesSquare,
  Bell,
  User,
  PanelLeft,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuBadge,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  useSidebar,
} from "@/components/ui/sidebar";

const GROUPS = [
  {
    items: [{ key: "home", label: "Home", icon: Home }],
  },
  {
    label: "Tickets & orders",
    items: [
      { key: "tickets", label: "Tickets", icon: Ticket },
      { key: "orders", label: "Orders", icon: ShoppingBag },
      { key: "memberships", label: "Memberships", icon: BadgeCheck },
    ],
  },
  {
    label: "Support",
    items: [
      { key: "messages", label: "Messages", icon: MessagesSquare },
      { key: "notifications", label: "Notifications", icon: Bell },
    ],
  },
  {
    label: "You",
    items: [{ key: "account", label: "Account", icon: User }],
  },
];

export function PortalSidebar({ tab, onTab, counts = {}, basePath }) {
  const { toggleSidebar } = useSidebar();

  return (
    <Sidebar
      collapsible="icon"
      className="border-r border-sidebar-border bg-sidebar text-sidebar-foreground"
    >
      <SidebarHeader className="h-14 justify-center border-b border-sidebar-border px-3 md:hidden">
        <div className="flex items-center gap-2">
          <Image
            src={`${basePath}/logo1.svg`}
            alt="Geiger Events"
            width={20}
            height={20}
            className="geiger-logo"
          />
          <span className="text-sm font-semibold text-foreground">Geiger Events</span>
        </div>
      </SidebarHeader>

      <SidebarContent className="py-1">
        {GROUPS.map((group, i) => (
          <SidebarGroup key={group.label || i}>
            {group.label ? (
              <SidebarGroupLabel className="text-[11px] uppercase tracking-wider text-text-tertiary">
                {group.label}
              </SidebarGroupLabel>
            ) : null}
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const badge = counts[item.key];
                  const highlight = item.key === "messages" || item.key === "notifications";
                  return (
                    <SidebarMenuItem key={item.key}>
                      <SidebarMenuButton
                        isActive={tab === item.key}
                        tooltip={item.label}
                        onClick={() => onTab(item.key)}
                      >
                        <item.icon />
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                      {badge ? (
                        <SidebarMenuBadge
                          className={
                            highlight ? "bg-primary text-primary-foreground" : undefined
                          }
                        >
                          {badge}
                        </SidebarMenuBadge>
                      ) : null}
                    </SidebarMenuItem>
                  );
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
      </SidebarContent>

      <SidebarFooter className="mt-auto border-t border-sidebar-border p-2">
        <Button
          variant="ghost"
          size="sm"
          onClick={toggleSidebar}
          className="justify-start text-muted-foreground hover:bg-sidebar-accent hover:text-foreground group-data-[collapsible=icon]:justify-center"
        >
          <PanelLeft className="h-4 w-4 shrink-0" />
          <span className="group-data-[collapsible=icon]:hidden">Collapse</span>
        </Button>
      </SidebarFooter>

      <SidebarRail />
    </Sidebar>
  );
}

export default PortalSidebar;
