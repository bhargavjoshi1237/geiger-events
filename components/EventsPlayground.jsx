"use client";

import React, { Suspense, useMemo } from "react";
import { AppSidebar } from "@/components/internal/sidebar/sidebar";
import { Topbar } from "@/components/internal/topbar/topbar";
import { SidebarProvider, SidebarInset } from "@geiger/ui/sidebar";
import { getScreen } from "@/components/internal/screens/registry";
import { ComingSoonScreen } from "@/components/internal/screens/coming_soon";
import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";
import { ProjectProvider, useProject } from "@/context/project-context";
import { AddonsProvider } from "@/context/addons-context";
import { NavVisibilityProvider } from "@/context/nav-visibility-context";
import { RbacProvider } from "@/context/rbac-context";
import { useWorkspaceUrl, DEFAULT_TAB } from "@/lib/hooks/use-workspace-url";
import { PlaygroundWorkspaceUrlProvider } from "@/components/landing/playground_workspace_url";
import { ScreenErrorBoundary } from "@/components/landing/screen_error_boundary";
import { usePlaygroundMode } from "@/lib/playground/use_playground_mode";
import { playgroundHandlers, playgroundRoutes } from "@/lib/playground/handlers";

const BASE_PATH = process.env.NEXT_PUBLIC_BASE_PATH || "";
const MODE_OPTIONS = { routes: playgroundRoutes, basePath: BASE_PATH };

// Tabs whose screen draws from bundled sample data rather than the data layer (charts over figures no table stores), so they keep their `demo` path.
const DEMO_TABS = new Set([]);

// Resolve a tab title to its nav entry (top-level or sub-item), like the shell.
function findNavItem(title) {
  for (const item of workspaceNav) {
    if (item.title === title) return item;
    const sub = item.subItems?.find((s) => s.title === title);
    if (sub) return sub;
  }
  return workspaceNav[0] || { title: DEFAULT_TAB };
}

// The screen for the active tab, resolved through the same registry as app/project/[projectId]/[[...rest]]/page.js.
function PlaygroundScreen({ activeItem }) {
  const { project, loading } = useProject();
  if (loading || !project) return <LoadingArea />;
  const Screen = getScreen(activeItem.title);
  if (!Screen) return <ComingSoonScreen title={activeItem.title} icon={activeItem.icon} />;
  return (
    <div key={project.id} className="h-full">
      {DEMO_TABS.has(activeItem.title) ? <Screen demo /> : <Screen />}
    </div>
  );
}

// Mirrors the project workspace shell (app/project/[projectId]/workspace_layout.jsx), filling the /playground page.
function EventsPlaygroundContent() {
  const { tab: currentTab, setTab } = useWorkspaceUrl();
  const activeItem = useMemo(() => findNavItem(currentTab), [currentTab]);

  return (
    <div className="flex-col h-[100dvh] w-full bg-background text-foreground font-sans overflow-hidden selection:bg-surface-strong flex">
      <SidebarProvider
        className="flex-col !flex h-full min-w-0"
        style={{ flexDirection: "column" }}
      >
        <Topbar />
        <div className="flex flex-1 overflow-hidden relative">
          <AppSidebar activeTab={currentTab} onTabChange={setTab} />
          <SidebarInset className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative border-none">
            <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full"></div>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full min-w-0">
              <ScreenErrorBoundary key={currentTab} title={activeItem.title}>
                <PlaygroundScreen activeItem={activeItem} />
              </ScreenErrorBoundary>
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

// The landing playground: the real Events workspace (shell, sidebar, topbar and every registry screen) on Halcyon Studio's
// seeded project, served by the in-memory database in lib/playground. Navigation stays in React state, edits last until reload.
export function EventsPlayground() {
  usePlaygroundMode(playgroundHandlers, MODE_OPTIONS);

  return (
    <Suspense fallback={<div className="h-[100dvh] w-full bg-background" />}>
      <PlaygroundWorkspaceUrlProvider>
        <ProjectProvider>
          <AddonsProvider>
            <RbacProvider>
              <NavVisibilityProvider>
                <EventsPlaygroundContent />
              </NavVisibilityProvider>
            </RbacProvider>
          </AddonsProvider>
        </ProjectProvider>
      </PlaygroundWorkspaceUrlProvider>
    </Suspense>
  );
}

export default EventsPlayground;
