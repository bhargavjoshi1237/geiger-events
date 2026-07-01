"use client";

import React, { useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2 } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { useProject } from "@/context/project-context";
import { getWall } from "@/lib/supabase/event_wall";
import { NAV_GROUPS, SECTIONS } from "./wall_sections";

// Top-level, self-contained screen (registered under "Event Wall" in
// registry.jsx) — reached directly from the sidebar, not via a list row, so
// unlike EventDetailScreen there's no back button or list to return to. The
// section (?section=) shares the same URL param the event editor uses; since
// they're never open at once that's harmless.
export function EventWallScreen() {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
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

  const activeItem = useMemo(
    () =>
      NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === active) ||
      NAV_GROUPS[0].items[0],
    [active],
  );

  const viewLive = () => {
    if (typeof window !== "undefined") {
      window.open(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/w/${wall?.slug || "events"}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
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

  const ActiveSection = SECTIONS[active] || SECTIONS.general;

  return (
    <MainScreenWrapper>
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
            Event Wall
          </h1>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            The public page listing every event you&apos;ve marked listable.
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={viewLive}
          >
            <ExternalLink className="h-4 w-4" /> View live
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="mb-5">
            <h2 className="text-lg font-semibold capitalize text-white">
              {activeItem.label}
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">{activeItem.desc}</p>
          </div>
          <ActiveSection wall={wall} headerItem={activeItem} />
        </div>

        <aside className="order-1 lg:order-2">
          <nav className="space-y-5 lg:sticky lg:top-0 lg:h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {NAV_GROUPS.map((group, gi) => (
              <div key={group.group || `g${gi}`}>
                {group.group ? (
                  <p className="mb-1.5 px-3 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
                    {group.group}
                  </p>
                ) : null}
                <div className="space-y-0.5">
                  {group.items.map((item) => {
                    const Icon = item.icon;
                    const isActive = active === item.key;
                    return (
                      <button
                        key={item.key}
                        type="button"
                        onClick={() => setActive(item.key)}
                        className={cn(
                          "flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm transition-colors",
                          isActive
                            ? "bg-surface-card font-medium text-white"
                            : "text-muted-foreground hover:bg-surface-subtle hover:text-foreground",
                        )}
                      >
                        <Icon
                          className={cn(
                            "h-4 w-4 shrink-0",
                            isActive ? "text-white" : "text-text-secondary",
                          )}
                        />
                        <span className="truncate capitalize">{item.label}</span>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </nav>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default EventWallScreen;
