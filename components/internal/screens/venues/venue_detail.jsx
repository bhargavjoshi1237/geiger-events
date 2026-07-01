"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, MapPin } from "lucide-react";

import { MainScreenWrapper } from "@/components/internal/shared/screen_wrappers";
import { StatusPill } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useWorkspaceUrl } from "@/lib/hooks/use-workspace-url";

import { VENUE_STATUS_MAP, venueLocation } from "./constants";
import { VENUE_NAV, SECTIONS } from "./venue_sections";

export function VenueDetailScreen({ venue, onBack, onUpdate }) {
  // The active editor section lives in the URL (?section=<key>) so a refresh
  // keeps the user on the same section inside the venue. The shared default
  // ("overview") isn't a venue section, so resolve it to the first one.
  const { section: rawSection, setSection: setActive } = useWorkspaceUrl();
  const active = VENUE_NAV.some((i) => i.key === rawSection)
    ? rawSection
    : "details";
  // Editable working copy. Sections patch this; the header reflects edits live,
  // and Save lifts it back to the list (which persists).
  const [form, setForm] = useState(venue);
  // Re-seed when a different venue is opened (render-phase reset).
  const [seedId, setSeedId] = useState(venue?.id);
  if (venue && venue.id !== seedId) {
    setSeedId(venue.id);
    setForm(venue);
  }

  const activeItem = useMemo(
    () => VENUE_NAV.find((i) => i.key === active) || VENUE_NAV[0],
    [active],
  );

  if (!venue) return null;

  const patch = (partial) => setForm((f) => ({ ...f, ...partial }));

  // Commit = patch + persist immediately. Used by the media section so uploads
  // stick without a separate Save.
  const commit = (partial) => {
    const next = { ...form, ...partial };
    setForm(next);
    onUpdate?.(next);
  };

  const save = () => {
    onUpdate?.(form);
    toast.success("Changes saved.");
  };

  const ActiveSection = SECTIONS[active] || SECTIONS.details;
  const location = venueLocation(form);

  return (
    <MainScreenWrapper>
      {/* Editor header */}
      <div className="flex flex-col gap-4 border-b border-border pb-6 md:flex-row md:items-center md:justify-between">
        <div className="min-w-0">
          <button
            type="button"
            onClick={onBack}
            className="mb-2 inline-flex items-center gap-1.5 text-sm font-medium text-text-secondary transition-colors hover:text-foreground"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            All venues
          </button>
          <div className="flex flex-wrap items-center gap-2.5">
            <h1 className="text-2xl font-semibold tracking-tight text-foreground md:text-3xl">
              {form.name || "Untitled venue"}
            </h1>
            <StatusPill status={form.status} map={VENUE_STATUS_MAP} />
          </div>
          <p className="mt-1 flex items-center gap-1.5 text-sm font-medium text-muted-foreground">
            <MapPin className="h-3.5 w-3.5 text-text-secondary" />
            {[form.type, location].filter(Boolean).join(" · ") || "No location yet"}
          </p>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2">
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={save}
          >
            Save changes
          </Button>
        </div>
      </div>

      {/* Content (left) + section nav (right) */}
      <div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_260px]">
        <div className="order-2 min-w-0 lg:order-1">
          <div className="mb-5">
            <h2 className="text-lg font-semibold capitalize text-white">
              {activeItem.label}
            </h2>
            <p className="mt-0.5 text-sm text-text-secondary">{activeItem.desc}</p>
          </div>
          <ActiveSection venue={form} patch={patch} commit={commit} />
        </div>

        <aside className="order-1 lg:order-2">
          <nav className="space-y-0.5 lg:sticky lg:top-0 lg:h-[calc(100dvh-7.5rem)] lg:overflow-y-auto lg:pr-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            {VENUE_NAV.map((item) => {
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
                  <span className="truncate">{item.label}</span>
                </button>
              );
            })}
          </nav>
        </aside>
      </div>
    </MainScreenWrapper>
  );
}

export default VenueDetailScreen;
