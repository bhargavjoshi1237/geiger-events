"use client";

import React, { useEffect, useMemo, useState } from "react";
import { Handshake, Loader2, Mic, Plus } from "lucide-react";

import { EditorSectionHeader, StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { useProject } from "@/context/project-context";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { conferenceApi } from "@/lib/supabase/conference";
import {
  SPEAKER_STATUS_MAP,
  SPONSOR_STATUS_MAP,
} from "../conference/constants";
import { initials } from "./sample_data";

// Event-editor sections that attach reusable Conference records (speakers /
// sponsors) to this event. Selection lives under its own metadata key
// (metadata.speakerIds / metadata.sponsorIds) — an array of conference_records
// ids — so the shallow-merge save never clobbers another section. The public
// event page can read these ids to render its speaker/sponsor line-up.

function AttachRecordsSection({
  event,
  headerItem,
  module,
  metaKey,
  statusMap,
  subtitle,
  icon: Icon,
  tabTitle,
  fallbackTitle,
  fallbackDesc,
}) {
  const { projectId } = useProject();
  const { setTab } = useWorkspaceUrl();
  const [stored, , save] = useEventConfig(event, metaKey, []);
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    conferenceApi.list(projectId, module).then((rows) => {
      if (!alive) return;
      setRecords(rows ?? []);
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, [projectId, module]);

  const selected = useMemo(() => (Array.isArray(stored) ? stored : []), [stored]);
  const selectedCount = useMemo(
    () => records.filter((r) => selected.includes(r.id)).length,
    [records, selected],
  );

  const toggle = (id) => {
    save(
      selected.includes(id)
        ? selected.filter((x) => x !== id)
        : [...selected, id],
    );
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || fallbackTitle}
        description={headerItem?.desc || fallbackDesc}
        action={
          <Button
            variant="outline"
            onClick={() => setTab(tabTitle)}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Manage {tabTitle.toLowerCase()}
          </Button>
        }
      />

      {loading ? (
        <div className="flex items-center justify-center gap-2 rounded-xl border border-border bg-surface-subtle px-6 py-12 text-sm text-text-secondary">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading {tabTitle.toLowerCase()}…
        </div>
      ) : records.length === 0 ? (
        <div className="flex flex-col items-start gap-2 rounded-xl border border-dashed border-border bg-surface-card px-6 py-10">
          <p className="text-sm text-text-secondary capitalize">
            No {tabTitle.toLowerCase()} in this project yet.
          </p>
          <Button
            size="sm"
            variant="outline"
            onClick={() => setTab(tabTitle)}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Create one
          </Button>
        </div>
      ) : (
        <>
          {selectedCount ? (
            <p className="text-xs text-text-secondary">
              {selectedCount} attached to this event.
            </p>
          ) : null}
          <div className="space-y-2.5">
            {records.map((r) => {
              const on = selected.includes(r.id);
              return (
                <div
                  key={r.id}
                  className={cn(
                    "flex items-center gap-3 rounded-xl border border-border bg-surface-card p-3 transition-opacity",
                    on ? "" : "opacity-70",
                  )}
                >
                  {r.coverUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={r.coverUrl}
                      alt=""
                      className="h-10 w-10 shrink-0 rounded-full border border-border object-cover"
                    />
                  ) : (
                    <Avatar className="h-10 w-10 shrink-0 border border-border">
                      <AvatarFallback className="bg-surface-subtle text-xs text-muted-foreground">
                        {Icon ? <Icon className="h-4 w-4" /> : initials(r.name || "?")}
                      </AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {r.name}
                    </p>
                    {subtitle(r) ? (
                      <p className="truncate text-xs text-text-secondary">{subtitle(r)}</p>
                    ) : null}
                  </div>
                  <StatusPill status={r.status} map={statusMap} />
                  <div className="flex items-center self-center">
                    <Switch
                      checked={on}
                      onCheckedChange={() => toggle(r.id)}
                      aria-label={on ? `Remove ${r.name}` : `Attach ${r.name}`}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}
    </div>
  );
}

export function EventSpeakersSection({ event, headerItem }) {
  return (
    <AttachRecordsSection
      event={event}
      headerItem={headerItem}
      module="speaker"
      metaKey="speakerIds"
      statusMap={SPEAKER_STATUS_MAP}
      icon={Mic}
      tabTitle="Speakers"
      fallbackTitle="Speakers"
      fallbackDesc="Attach speakers from your Conference roster to this event's line-up."
      subtitle={(r) => [r.config?.title, r.config?.company].filter(Boolean).join(" · ")}
    />
  );
}

export function EventSponsorsSection({ event, headerItem }) {
  return (
    <AttachRecordsSection
      event={event}
      headerItem={headerItem}
      module="sponsor"
      metaKey="sponsorIds"
      statusMap={SPONSOR_STATUS_MAP}
      icon={Handshake}
      tabTitle="Sponsors"
      fallbackTitle="Sponsors"
      fallbackDesc="Attach sponsors backing this event — shown on the event page and in sponsor reporting."
      subtitle={(r) =>
        [r.config?.tier, r.config?.contactName].filter(Boolean).join(" · ")
      }
    />
  );
}

export default EventSpeakersSection;
