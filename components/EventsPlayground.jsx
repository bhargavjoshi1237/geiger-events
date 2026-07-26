"use client";

import React, { Suspense, useMemo } from "react";
import dynamic from "next/dynamic";
import { AppSidebar } from "@/components/internal/sidebar/sidebar";
import { Topbar } from "@/components/internal/topbar/topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { EventsOverviewScreen } from "@/components/internal/screens/overview/events_overview";
import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { ProjectProvider } from "@/context/project-context";
import { useWorkspaceUrl, DEFAULT_TAB } from "@/lib/hooks/use-workspace-url";
import { PlaygroundWorkspaceUrlProvider } from "@/components/landing/playground_workspace_url";
import { ScreenErrorBoundary } from "@/components/landing/screen_error_boundary";

// The registry statically imports every screen in the app, so it is loaded on
// demand — a visitor who never leaves Overview never downloads the workspace.
const PlaygroundScreenHost = dynamic(
  () => import("@/components/landing/playground_screen_host"),
  { ssr: false, loading: () => <LoadingArea /> },
);

// Resolve a tab title to its nav entry (top-level or sub-item), like the shell.
function findNavItem(title) {
  for (const item of workspaceNav) {
    if (item.title === title) return item;
    const sub = item.subItems?.find((s) => s.title === title);
    if (sub) return sub;
  }
  return workspaceNav[0] || { title: DEFAULT_TAB };
}

// Live, embeddable copy of the Events dashboard used on the landing page.
// Mirrors the project workspace shell but fills its container (h-full) instead of
// the viewport, and resolves every sidebar tab through the same screen registry —
// so the whole app is browsable from the marketing page. Navigation is in-memory
// (see PlaygroundWorkspaceUrlProvider), so opening an event, venue or record
// stays inside the embed. No save, no load — a throwaway instance of the real
// interface.
function EventsPlaygroundContent() {
  const { tab: currentTab, setTab } = useWorkspaceUrl();
  const activeItem = useMemo(() => findNavItem(currentTab), [currentTab]);

  return (
    <div className="flex-col h-full w-full bg-background text-foreground font-sans overflow-hidden selection:bg-surface-strong flex">
      <SidebarProvider
        className="flex-col !flex h-full min-w-0"
        style={{ flexDirection: "column" }}
      >
        <Topbar />
        <div className="flex flex-1 overflow-hidden relative">
          <AppSidebar activeTab={currentTab} onTabChange={setTab} />
          <SidebarInset className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative border-none">
            <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full"></div>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full min-w-0 [&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]">
              <ScreenErrorBoundary key={currentTab} title={activeItem.title}>
                {currentTab === DEFAULT_TAB ? (
                  <EventsOverviewScreen demo />
                ) : (
                  <PlaygroundScreenHost activeItem={activeItem} />
                )}
              </ScreenErrorBoundary>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

// Screens here read the active project via useProject(), so the playground needs
// its own ProjectProvider (like the real workspace shell) — wrapped in the
// in-memory URL provider so neither the provider nor the screens touch the
// landing page's own URL. Suspense is required because the routed hook underneath
// reads useSearchParams. On the public landing page no session resolves, so the
// playground stays project-less and screens render their empty (or demo) states.
export function EventsPlayground() {
  return (
    <Suspense fallback={<div className="h-full w-full bg-background" />}>
      <PlaygroundWorkspaceUrlProvider>
        <ProjectProvider>
          <EventsPlaygroundContent />
        </ProjectProvider>
      </PlaygroundWorkspaceUrlProvider>
    </Suspense>
  );
}

export default EventsPlayground;
