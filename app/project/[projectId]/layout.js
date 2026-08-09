"use client";

import React, { Suspense } from "react";
import { AppSidebar } from "@/components/internal/sidebar/sidebar";
import { Topbar } from "@/components/internal/topbar/topbar";
import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { ProjectProvider } from "@/context/project-context";
import { AddonsProvider } from "@/context/addons-context";
import { NavVisibilityProvider } from "@/context/nav-visibility-context";
import { RbacProvider } from "@/context/rbac-context";

// The workspace shell: the chrome, and the four providers behind it.
//
// This is a LAYOUT rather than part of the page on purpose. The active tab is a
// path segment (/project/<id>/<tab>, the [[...rest]] catch-all), and Next keys
// every segment's subtree by its cache key — so changing tabs unmounts and
// remounts everything under the page. With the providers there, each navigation
// reset them to their initial state and re-ran their fetches: the sidebar
// flashed the un-curated nav and the database was queried on every tab change.
//
// A layout sits above the segment that changes, so it survives the navigation.
// The shell now mounts once per project: one load of the addon rows, the grants
// and the hidden list per page visit, and the sidebar's expanded groups and
// scroll offset stay put while the user moves around.

function WorkspaceShell({ children }) {
  // The active tab lives in the URL (path) so a refresh keeps the user in place.
  const { tab, setTab } = useWorkspaceUrl();

  return (
    <div className="flex-col h-[100dvh] w-full bg-background text-foreground font-sans overflow-hidden selection:bg-surface-strong flex">
      <SidebarProvider
        className="flex-col !flex h-full min-w-0"
        style={{ flexDirection: "column" }}
      >
        <Topbar />
        <div className="flex flex-1 overflow-hidden relative">
          <AppSidebar activeTab={tab} onTabChange={setTab} />
          <SidebarInset className="flex-1 flex flex-col h-full bg-transparent overflow-hidden relative border-none">
            <div className="absolute top-0 right-0 w-[500px] h-[300px] bg-white/[0.02] blur-[120px] pointer-events-none rounded-full"></div>
            <main className="flex-1 overflow-y-auto p-4 md:p-8 relative z-10 w-full min-w-0">
              {children}
            </main>
          </SidebarInset>
        </div>
      </SidebarProvider>
    </div>
  );
}

export default function ProjectWorkspaceLayout({ children }) {
  // useSearchParams / useParams (via useWorkspaceUrl, used by every provider
  // here and by the page below) need a Suspense boundary above them.
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-background" />
      }
    >
      <ProjectProvider>
        {/* Addon enablement is per project, so it loads inside ProjectProvider. */}
        <AddonsProvider>
          {/* Grants are per (project, user) and gate the nav the addons have
              already been merged into, so RBAC sits between the two. */}
          <RbacProvider>
            {/* Sidebar curation sits under all three: hiding an entry narrows
                what the grant already allows, and can never widen it. */}
            <NavVisibilityProvider>
              <WorkspaceShell>{children}</WorkspaceShell>
            </NavVisibilityProvider>
          </RbacProvider>
        </AddonsProvider>
      </ProjectProvider>
    </Suspense>
  );
}
