"use client";

import React, { Suspense, useState } from "react";
import { AppSidebar } from "@/components/internal/sidebar/sidebar";
import { Topbar } from "@/components/internal/topbar/topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { PlaceholderScreen } from "@/components/internal/screens/placeholder_screen";
import { EventsOverviewScreen } from "@/components/internal/screens/overview/events_overview";
import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { ProjectProvider } from "@/context/project-context";

// Live, embeddable copy of the Events dashboard used on the landing page.
// Mirrors app/home/page.js but fills its container (h-full) instead of the
// viewport so it can be mounted inside the playground showcase. No save, no
// load — it's a throwaway, fully interactive instance of the real interface.
function EventsPlaygroundContent() {
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

  return (
    <div className="flex-col h-full w-full bg-background text-foreground font-sans overflow-hidden selection:bg-surface-strong flex">
      <SidebarProvider
        className="flex-col !flex h-full min-w-0"
        style={{ flexDirection: "column" }}
      >
        <Topbar />
        <div className="flex flex-1 overflow-hidden relative">
          <AppSidebar activeTab={currentTab} onTabChange={setCurrentTab} />
          <SidebarInset className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative border-none">
            <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full"></div>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              {currentTab === "Overview" ? (
                <EventsOverviewScreen />
              ) : (
                <MainScreenWrapper>
                  <PlaceholderScreen title={activeItem.title} icon={activeItem.icon} />
                </MainScreenWrapper>
              )}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

// Screens here read the active project via useProject(), so the playground needs
// its own ProjectProvider (like the real workspace shell). Suspense is required
// because the provider reads the URL via useSearchParams. On the public landing
// page no session resolves, so it stays project-less and the screens render empty.
export function EventsPlayground() {
  return (
    <Suspense
      fallback={<div className="h-full w-full bg-background" />}
    >
      <ProjectProvider>
        <EventsPlaygroundContent />
      </ProjectProvider>
    </Suspense>
  );
}

export default EventsPlayground;
