"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { MapPin } from "lucide-react";

import { EditorShell } from "@/components/internal/shared/editor_shell";
import { Button } from "@geiger/ui/button";

import { VENUE_STATUS_MAP, venueLocation } from "./constants";
import { VENUE_NAV, SECTIONS } from "./venue_sections";

export function VenueDetailScreen({ venue, onBack, onUpdate }) {
  // Editable working copy. Sections patch this; the header reflects edits live,
  // and Save lifts it back to the list (which persists).
  const [form, setForm] = useState(venue);
  // Re-seed when a different venue is opened (render-phase reset).
  const [seedId, setSeedId] = useState(venue?.id);
  if (venue && venue.id !== seedId) {
    setSeedId(venue.id);
    setForm(venue);
  }

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

  const location = venueLocation(form);

  return (
    <EditorShell
      back={{ label: "All venues", onClick: onBack }}
      title={form.name || "Untitled venue"}
      status={form.status}
      statusMap={VENUE_STATUS_MAP}
      meta={
        <span className="flex items-center gap-1.5">
          <MapPin className="h-3.5 w-3.5 text-text-secondary" />
          {[form.type, location].filter(Boolean).join(" · ") || "No location yet"}
        </span>
      }
      actions={
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          onClick={save}
        >
          Save Changes
        </Button>
      }
      nav={VENUE_NAV}
      sections={SECTIONS}
      sectionProps={{ venue: form, patch, commit }}
      defaultSection="details"
    />
  );
}

export default VenueDetailScreen;
