"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, Eye, ExternalLink } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

import { EVENT_STATUS_MAP, formatDate } from "./sample_data";
import { EventPublicPage } from "./event_public_page";
import { PageDesignSection, defaultPageDesign } from "./page_design";
import { NAV_GROUPS, SECTIONS } from "./event_sections";
import { updateEventMeta } from "@/lib/supabase/events";

export function EventDetailScreen({ event, onBack, onUpdate }) {
  // The active editor section lives in the URL (?section=<key>) so a refresh
  // keeps the user on the same tab inside the event.
  const { section: active, setSection: setActive } = useWorkspaceUrl();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [design, setDesign] = useState(
    () => event?.pageDesign || defaultPageDesign(),
  );
  // Editable working copy of the event. Sections read from and patch this; the
  // header and preview reflect edits live, and Save lifts it back to the list.
  const [form, setForm] = useState(event);
  // Re-seed when a different event is opened (render-phase reset — React's
  // recommended alternative to a setState-in-effect).
  const [seedId, setSeedId] = useState(event?.id);
  if (event && event.id !== seedId) {
    setSeedId(event.id);
    setForm(event);
    setDesign(event?.pageDesign || defaultPageDesign());
  }

  const activeItem = useMemo(
    () =>
      NAV_GROUPS.flatMap((g) => g.items).find((i) => i.key === active) ||
      NAV_GROUPS[0].items[0],
    [active],
  );

  if (!event) return null;

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }));

  // Commit = patch + persist immediately. Used by the Overview dashboard so its
  // controls (status, visibility, publish) take effect without a separate Save.
  const commit = (partial) => {
    const next = { ...form, ...partial };
    setForm(next);
    onUpdate?.(next);
  };

  const save = () => {
    const next = { ...form, pageDesign: design };
    onUpdate?.(next);
    // Page design lives in the metadata bag, not a column — persist it there.
    updateEventMeta(form.id, { pageDesign: design });
    toast.success("Changes saved.");
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

  const ActiveSection = SECTIONS[active] || SECTIONS.overview;

  return (
    <MainScreenWrapper className="lg:flex lg:h-full lg:flex-col lg:gap-6 lg:space-y-0 lg:overflow-hidden lg:py-0">
      {/* Editor header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between lg:shrink-0">
        <div className="min-w-0">
          {/* Breadcrumb back — reads as part of the page rather than a stray
              icon button, matching the suite's text-link navigation. */}
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All events
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {form.name}
            </h1>
            <StatusPill status={form.status} map={EVENT_STATUS_MAP} />
          </div>
          <p className="mt-1 text-sm font-medium text-muted-foreground">
            {formatDate(form.date)} · {form.time} · {form.venue}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={viewLive}
          >
            <ExternalLink className="h-4 w-4" /> 
          </Button>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setPreviewOpen(true)}
          >
            <Eye className="h-4 w-4" /> Preview
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={save}
          >
            Save changes
          </Button>
        </div>
      </div>

      {/* Content (left) + section nav (right). On lg the grid fills the
          remaining editor height (one 1fr row) so each column scrolls inside
          its own area rather than growing the page. */}
      <div className="grid grid-cols-1 gap-8 lg:min-h-0 lg:flex-1 lg:grid-rows-1 lg:grid-cols-[1fr_260px]">
        <div className="scrollbar-subtle order-2 min-w-0 lg:order-1 lg:min-h-0 lg:overflow-y-auto lg:pr-2">
          {/* Sections flagged `ownHeader` render their own title row (e.g. so
              summary stats can sit beside it); everything else gets the
              standard label + description block. */}
          {activeItem.ownHeader ? null : (
            <div className="mb-5 flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold capitalize text-white">
                  {activeItem.label}
                </h2>
                <p className="mt-0.5 text-sm text-text-secondary">
                  {activeItem.desc}
                </p>
              </div>
              {active === "design" ? (
                <Button
                  size="sm"
                  variant="outline"
                  className="shrink-0 border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => setPreviewOpen(true)}
                >
                  <Eye className="h-4 w-4" /> Preview
                </Button>
              ) : null}
            </div>
          )}
          {active === "design" ? (
            <PageDesignSection
              design={design}
              onChange={setDesign}
              onPreview={() => setPreviewOpen(true)}
            />
          ) : (
            <ActiveSection
              event={form}
              headerItem={activeItem}
              onPatch={patch}
              onCommit={commit}
              onNavigate={setActive}
              onPreview={() => setPreviewOpen(true)}
              onViewLive={viewLive}
            />
          )}
        </div>

        <aside className="order-1 lg:order-2 lg:min-h-0">
          {/* Fills the editor column and scrolls inside its own area rather than
              the whole page. The thin scrollbar is hidden to match the suite's
              chrome-free scroll surfaces. */}
          <nav className="space-y-5 lg:h-full lg:overflow-y-auto lg:pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
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

      {previewOpen ? (
        <EventPublicPage
          event={form}
          design={design}
          onClose={() => setPreviewOpen(false)}
        />
      ) : null}
    </MainScreenWrapper>
  );
}

export default EventDetailScreen;
