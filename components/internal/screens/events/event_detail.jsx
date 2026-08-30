"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Eye, ExternalLink } from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import { Button } from "@geiger/ui/button";
import { useAddons } from "@/context/addons-context";

import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";
import { EVENT_STATUS_MAP, formatDate } from "./sample_data";
import { EventPublicPage } from "./event_public_page";
import { PageDesignSection, defaultPageDesign } from "./page_design";
import { NAV_GROUPS, SECTIONS } from "./event_sections";
import { updateEventMeta } from "@/lib/supabase/events";

export function EventDetailScreen({ event, onBack, onUpdate }) {
  const { section: active, setSection: setActive } = useWorkspaceUrl();
  const { isEnabled } = useAddons();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [design, setDesign] = useState(
    () => event?.pageDesign || defaultPageDesign(),
  );
  const [form, setForm] = useState(event);
  const [seedId, setSeedId] = useState(event?.id);
  if (event && event.id !== seedId) {
    setSeedId(event.id);
    setForm(event);
    setDesign(event?.pageDesign || defaultPageDesign());
  }

  if (!event) return null;

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }));

  const commit = (partial) => {
    const next = { ...form, ...partial };
    setForm(next);
    onUpdate?.(next);
  };

  const save = () => {
    const next = { ...form, pageDesign: design };
    onUpdate?.(next);
    updateEventMeta(form.id, { pageDesign: design });
    toast.success("Changes saved.");
  };

  const persistDesign = async (next) => {
    setDesign(next);
    onUpdate?.({ ...form, pageDesign: next });
    return (await updateEventMeta(form.id, { pageDesign: next })) !== false;
  };

  const viewLive = () => {
    if (typeof window !== "undefined") {
      window.open(
        `${process.env.NEXT_PUBLIC_BASE_PATH || ""}/e/${form.id}`,
        "_blank",
        "noopener,noreferrer",
      );
    }
  };

  return (
    <EditorShell
      searchable
      back={{ label: "All Events", onClick: onBack }}
      title={form.name}
      status={form.status}
      statusMap={EVENT_STATUS_MAP}
      meta={
        [formatDate(form.date), form.time, form.venue]
          .filter(Boolean)
          .join(" · ") || "No date or venue set yet"
      }
      actions={
        <>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={viewLive}
            title="View live page"
            aria-label="View live page"
          >
            <ExternalLink className="h-4 w-4" />
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={save}
          >
            Save Changes
          </Button>
        </>
      }
      nav={NAV_GROUPS}
      subject={form}
      navContext={{ isEnabled }}
      active={active}
      onActiveChange={setActive}
      sectionAction={
        active === "design" ? (
          <Button
            size="sm"
            variant="outline"
            className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
        ) : null
      }
      after={
        previewOpen ? (
          <EventPublicPage
            event={form}
            design={design}
            onClose={() => setPreviewOpen(false)}
          />
        ) : null
      }
    >
      {({ activeItem }) => {
        if (active === "design") {
          return (
            <PageDesignSection
              design={design}
              event={form}
              onChange={setDesign}
              onPersist={persistDesign}
              onPreview={() => setPreviewOpen(true)}
              eventId={form?.id}
            />
          );
        }
        const ActiveSection = SECTIONS[active] || SECTIONS.overview;
        return (
          <ActiveSection
            event={form}
            headerItem={activeItem}
            onPatch={patch}
            onCommit={commit}
            onNavigate={setActive}
            onPreview={() => setPreviewOpen(true)}
            onViewLive={viewLive}
          />
        );
      }}
    </EditorShell>
  );
}

export default EventDetailScreen;
