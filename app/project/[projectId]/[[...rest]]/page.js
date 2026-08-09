"use client";

import React, { useEffect } from "react";
import { useRouter } from "next/navigation";
import { ComingSoonScreen } from "@/components/internal/screens/coming_soon";
import { getScreen } from "@/components/internal/screens/registry";
import { workspaceNav } from "@/components/internal/sidebar/sidebar_nav";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useProject, pickDefaultProjectId } from "@/context/project-context";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";

// The active screen only. The chrome and the providers live in the layout above
// (app/project/[projectId]/layout.js) because this page is remounted on every
// tab change — the tab is the [[...rest]] path segment.

// Gated on the path's project resolving to one the user can reach.
function ScreenArea({ activeItem, Screen }) {
  const router = useRouter();
  const { project, projects, loading } = useProject();

  // No reachable projects → login. A stale/invalid id in the path → a valid one.
  useEffect(() => {
    if (loading) return;
    if (projects.length === 0) {
      // Workspace intent: /login must not hijack a member cookie to /members.
      router.replace("/login?workspace=1");
      return;
    }
    if (project) return;
    const fallback = pickDefaultProjectId(projects);
    if (fallback) router.replace(`/project/${fallback}`);
  }, [loading, project, projects, router]);

  if (loading) return <LoadingArea />;
  if (projects.length === 0 || !project) return <LoadingArea />;

  return (
    <div key={project.id} className="h-full">
      {Screen ? (
        <Screen />
      ) : (
        <ComingSoonScreen title={activeItem.title} icon={activeItem.icon} />
      )}
    </div>
  );
}

export default function ProjectWorkspacePage() {
  const { tab: currentTab } = useWorkspaceUrl();

  const findActiveItem = () => {
    for (const item of workspaceNav) {
      if (item.title === currentTab) return item;
      const sub = item.subItems?.find((s) => s.title === currentTab);
      if (sub) return sub;
    }
    return workspaceNav[0] || { title: "Overview" };
  };

  return (
    <ScreenArea activeItem={findActiveItem()} Screen={getScreen(currentTab)} />
  );
}
