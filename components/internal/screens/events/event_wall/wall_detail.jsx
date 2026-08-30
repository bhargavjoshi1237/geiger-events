"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { Copy, ExternalLink, LayoutGrid, Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { EditorShell } from "@/components/internal/shared/editor_shell";
import { EmptyState } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { useProject } from "@/context/project-context";
import { getWall } from "@/lib/supabase/event_wall";
import { NAV_GROUPS, SECTIONS } from "./wall_sections";

export function EventWallScreen() {
  const { projectId } = useProject();
  const [wall, setWall] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    getWall(projectId).then((row) => {
      if (!alive) return;
      setWall(row);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId]);

  const wallPath = `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/w/${wall?.slug || "events"}`;
  const wallUrl =
    typeof window !== "undefined" ? `${window.location.origin}${wallPath}` : wallPath;

  const viewLive = () => {
    if (typeof window !== "undefined") {
      window.open(wallPath, "_blank", "noopener,noreferrer");
    }
  };

  const copyLink = () => {
    if (typeof navigator === "undefined" || !navigator.clipboard) return;
    navigator.clipboard.writeText(wallUrl).then(
      () => toast.success("Public link copied."),
      () => toast.error("Couldn't copy the link."),
    );
  };

  if (loading) {
    return (
      <MainScreenWrapper>
        <div className="flex h-64 items-center justify-center gap-2 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading…
        </div>
      </MainScreenWrapper>
    );
  }

  if (!wall) {
    return (
      <MainScreenWrapper>
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState
            icon={LayoutGrid}
            title="Event Wall unavailable"
            description="We couldn't load this project's public events page. Check your connection and refresh, or make sure a project is selected."
          />
        </div>
      </MainScreenWrapper>
    );
  }

  return (
    <EditorShell
      title="Event Wall"
      meta={
        <>
          <p>The public page listing every event you&apos;ve marked listable.</p>
          <button
            type="button"
            onClick={copyLink}
            title="Copy public link"
            className="group mt-2 inline-flex max-w-full items-center gap-1.5 rounded-md text-xs text-text-tertiary transition-colors hover:text-foreground"
          >
            <span className="truncate font-mono">{wallUrl}</span>
            <Copy className="h-3 w-3 shrink-0 opacity-60 group-hover:opacity-100" />
          </button>
        </>
      }
      actions={
        <>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={copyLink}
          >
            <Copy className="h-4 w-4" /> Copy link
          </Button>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={viewLive}
          >
            <ExternalLink className="h-4 w-4" /> View live
          </Button>
        </>
      }
      nav={NAV_GROUPS}
      sections={SECTIONS}
      sectionProps={{ wall, onWallChange: setWall }}
      defaultSection="general"
    />
  );
}

export default EventWallScreen;
