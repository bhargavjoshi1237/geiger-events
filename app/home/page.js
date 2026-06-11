"use client";

import React, { useState } from "react";
import { AppSidebar } from "@/components/internal/sidebar/sidebar";
import { Topbar } from "@/components/internal/topbar/topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { ComingSoonScreen } from "@/components/internal/screens/coming_soon";
import { getScreen } from "@/components/internal/screens/registry";
import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";

export default function Home() {
  const [currentTab, setCurrentTab] = useState("Overview");

  const findActiveItem = () => {
    for (const item of workspaceNav) {
      if (item.title === currentTab) return item;
      const sub = item.subItems?.find((s) => s.title === currentTab);
      if (sub) return sub;
    }
    return workspaceNav[0] || { title: "Overview" };
  };

  const activeItem = findActiveItem();
  const Screen = getScreen(currentTab);

  return (
    <div className="flex-col h-[100dvh] w-full bg-background text-foreground font-sans overflow-hidden selection:bg-surface-strong flex">
      <SidebarProvider
        className="flex-col !flex h-full min-w-0"
        style={{ flexDirection: "column" }}
      >
        <Topbar />
        <div className="flex flex-1 overflow-hidden relative">
          <AppSidebar activeTab={currentTab} onTabChange={setCurrentTab} />
          <SidebarInset className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative border-none">
            <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full"></div>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full min-w-0">
              {Screen ? (
                <Screen />
              ) : (
                <ComingSoonScreen
                  title={activeItem.title}
                  icon={activeItem.icon}
                />
              )}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}
