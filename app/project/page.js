"use client";

import React, { Suspense, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  ProjectProvider,
  useProject,
  pickDefaultProjectId,
} from "@/context/project-context";
import { LoadingArea } from "@/components/internal/workspace/workspace_states";

// Entry resolver for the project-scoped workspace. Opens the last-used (or
// first) project; a signed-out user with no reachable projects is sent to login.
function ProjectResolver() {
  const router = useRouter();
  const { projects, loading } = useProject();

  useEffect(() => {
    if (loading) return;
    if (projects.length === 0) {
      // Workspace intent: /login must not hijack a member cookie to /members.
      router.replace("/login?workspace=1");
      return;
    }
    const id = pickDefaultProjectId(projects);
    if (id) router.replace(`/project/${id}`);
  }, [loading, projects, router]);

  return <LoadingArea />;
}

export default function ProjectIndexPage() {
  return (
    <Suspense
      fallback={
        <div className="flex h-[100dvh] w-full items-center justify-center bg-background" />
      }
    >
      <ProjectProvider>
        <div className="h-[100dvh] w-full bg-background text-foreground">
          <ProjectResolver />
        </div>
      </ProjectProvider>
    </Suspense>
  );
}
