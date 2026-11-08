"use client";

import React, { useEffect, useState } from "react";
import { toast } from "sonner";
import { ArrowUpRight, Loader2, Plus, Store } from "lucide-react";

import { EmptyState, SectionCard } from "@/components/internal/shared/screen_kit";
import { Button, LogoLoading } from "@geiger/ui";
import { useOptionalProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { boothSummary } from "@/lib/event_design";
import { convertLegacyHall, listExpoHalls } from "@/lib/supabase/expo_halls";
import { HALLS_TAB } from "@/components/internal/screens/conference/expo_halls";

// A venue's exhibitor halls. Halls are drawn and edited under Sponsors & Expo → Floor Plan & Booths; this section lists
// the ones held at this venue and opens them there.

export function HallMapsSection({ venue }) {
  const projectId = useOptionalProject()?.projectId ?? null;
  const { openRecordInTab } = useWorkspaceUrl();
  const [halls, setHalls] = useState(null);
  const [opening, setOpening] = useState(null);

  useEffect(() => {
    if (!venue?.id || !projectId) return undefined;
    let alive = true;
    listExpoHalls(projectId).then((rows) => {
      if (alive) setHalls((rows ?? []).filter((h) => (h.plan?.venueId ?? h.map?.venueId) === venue.id));
    });
    return () => {
      alive = false;
    };
  }, [venue?.id, projectId]);

  const open = async (h) => {
    if (h.plan) {
      openRecordInTab?.(h.plan.id, HALLS_TAB);
      return;
    }
    setOpening(h.id);
    const plan = await convertLegacyHall(h.map, { projectId });
    setOpening(null);
    if (!plan) {
      toast.error("Couldn't open this hall.");
      return;
    }
    openRecordInTab?.(plan.id, HALLS_TAB);
  };

  const newHall = (
    <Button
      size="sm"
      variant="outline"
      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
      onClick={() => openRecordInTab?.(null, HALLS_TAB)}
    >
      <Plus className="h-4 w-4" /> New hall
    </Button>
  );

  if (halls === null) {
    return (
      <div className="flex h-40 items-center justify-center text-text-secondary">
        <LogoLoading size={40} />
      </div>
    );
  }

  return (
    <SectionCard
      title="Exhibitor halls"
      description="Expo floors at this venue. They're drawn under Sponsors & Expo → Floor Plan & Booths and sold from an event's Exhibitor Floor tab."
      action={newHall}
    >
      {halls.length === 0 ? (
        <EmptyState
          icon={Store}
          title="No exhibitor halls yet"
          description="Draw one under Floor Plan & Booths and set this venue on it — it shows up here."
        />
      ) : (
        <ul className="divide-y divide-border">
          {halls.map((h) => {
            const summary = boothSummary(h.plan?.objects);
            return (
              <li key={h.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                <div className="flex size-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-card">
                  <Store className="h-4 w-4 text-text-tertiary" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{h.plan?.name || h.map?.name || "Untitled hall"}</p>
                  <p className="truncate text-xs text-text-secondary">
                    {h.plan ? `${summary.count} booth${summary.count === 1 ? "" : "s"}` : "Older layout — opens in the floor plan editor"}
                  </p>
                </div>
                <Button
                  size="sm"
                  variant="ghost"
                  className="h-8 text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  disabled={opening === h.id}
                  onClick={() => open(h)}
                >
                  {opening === h.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <ArrowUpRight className="h-3.5 w-3.5" />}
                  Open
                </Button>
              </li>
            );
          })}
        </ul>
      )}
    </SectionCard>
  );
}

export default HallMapsSection;
