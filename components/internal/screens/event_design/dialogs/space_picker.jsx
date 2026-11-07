"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Loader2, Plus } from "lucide-react";

import {
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@geiger/ui";
import { Field } from "@/components/internal/shared/screen_kit";
import { createVenueSpace } from "@/lib/supabase/venue_spaces";
import { getUser } from "@/lib/supabase/user";
import { formatDimensions } from "@/lib/event_design";
import { LengthInput, NONE, UnitToggle } from "../fields";

// Venue → space picking for plans, plus a small inline "New space" dialog for when the venue has none yet.

export function NewSpaceDialog({ open, onOpenChange, projectId, venues, defaultVenueId, onCreated }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);

  const [seededFor, setSeededFor] = useState(null);
  if (open && seededFor !== (defaultVenueId || NONE)) {
    setSeededFor(defaultVenueId || NONE);
    setDraft({ venueId: defaultVenueId || venues?.[0]?.id || "", name: "", widthM: 20, lengthM: 15, unit: "m" });
  } else if (!open && seededFor !== null) {
    setSeededFor(null);
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const submit = async () => {
    if (!draft?.venueId) {
      toast.error("Pick the venue this space belongs to.");
      return;
    }
    if (!draft.name.trim()) {
      toast.error("Give the space a name.");
      return;
    }
    setBusy(true);
    const user = await getUser();
    const created = await createVenueSpace({
      id: crypto.randomUUID(),
      projectId,
      venueId: draft.venueId,
      name: draft.name.trim(),
      kind: "room",
      widthM: draft.widthM,
      lengthM: draft.lengthM,
      unit: draft.unit,
      createdBy: user?.id ?? null,
    });
    setBusy(false);
    if (!created) {
      toast.error("Couldn't create the space.");
      return;
    }
    toast.success(`Added "${created.name}".`);
    onCreated?.(created);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>New space</DialogTitle>
          <DialogDescription>
            A room inside the venue — plans drawn against it start at its real size.
          </DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="grid gap-4">
            <Field label="Venue">
              <Select value={draft.venueId || undefined} onValueChange={set("venueId")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Pick a venue" />
                </SelectTrigger>
                <SelectContent className="max-h-64">
                  {(venues || []).map((v) => (
                    <SelectItem key={v.id} value={v.id}>
                      {v.name || "Untitled venue"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Space name">
              <Input
                autoFocus
                value={draft.name}
                onChange={(e) => set("name")(e.target.value)}
                placeholder="e.g. Grand Ballroom"
              />
            </Field>
            <div className="flex items-end gap-3">
              <Field label="Width" className="flex-1">
                <LengthInput metres={draft.widthM} unit={draft.unit} onChange={set("widthM")} />
              </Field>
              <Field label="Length" className="flex-1">
                <LengthInput metres={draft.lengthM} unit={draft.unit} onChange={set("lengthM")} />
              </Field>
              <UnitToggle value={draft.unit} onChange={set("unit")} className="mb-1" />
            </div>
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={busy || !venues?.length}
            onClick={submit}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Add space
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Two selects (venue, then its spaces) and a "New space" shortcut. onChange({ venueId, spaceId, space }).
export function SpacePicker({ ctx, projectId, venueId, spaceId, onChange, requireSpace = false, stacked = false }) {
  const [newOpen, setNewOpen] = useState(false);
  const spaces = ctx.spaces.filter((s) => s.venueId === venueId);

  const pickVenue = (value) => {
    const id = value === NONE ? null : value;
    const first = requireSpace ? ctx.spaces.find((s) => s.venueId === id) || null : null;
    onChange({ venueId: id, spaceId: first?.id ?? null, space: first });
  };

  const pickSpace = (value) => {
    const space = value === NONE ? null : ctx.spaceById.get(value) || null;
    onChange({ venueId, spaceId: space?.id ?? null, space });
  };

  if (!ctx.venues.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-2.5 text-xs text-text-secondary">
        No venues yet — add one under Venues to link plans to a real room.
      </p>
    );
  }

  return (
    <div className={stacked ? "grid gap-3" : "grid gap-3 sm:grid-cols-2"}>
      <Field label="Venue">
        <Select value={venueId || (requireSpace ? "" : NONE)} onValueChange={pickVenue}>
          <SelectTrigger className="w-full">
            <SelectValue placeholder="Pick a venue" />
          </SelectTrigger>
          <SelectContent className="max-h-64">
            {requireSpace ? null : <SelectItem value={NONE}>No venue</SelectItem>}
            {ctx.venues.map((v) => (
              <SelectItem key={v.id} value={v.id}>
                {v.name || "Untitled venue"}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </Field>
      <Field label="Space">
        <div className="flex items-center gap-1.5">
          <Select value={spaceId || (requireSpace ? "" : NONE)} onValueChange={pickSpace} disabled={!venueId}>
            <SelectTrigger className="w-full min-w-0">
              <SelectValue placeholder={spaces.length ? "Pick a space" : "No spaces yet"} />
            </SelectTrigger>
            <SelectContent className="max-h-64">
              {requireSpace ? null : <SelectItem value={NONE}>Whole venue</SelectItem>}
              {spaces.map((s) => (
                <SelectItem key={s.id} value={s.id}>
                  {s.name}
                  {s.widthM && s.lengthM ? (
                    <span className="text-text-tertiary"> · {formatDimensions(s.widthM, s.lengthM, s.unit)}</span>
                  ) : null}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button
            type="button"
            variant="ghost"
            size="icon-sm"
            aria-label="New space"
            title="New space"
            disabled={!venueId}
            className="shrink-0 text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => setNewOpen(true)}
          >
            <Plus className="h-4 w-4" />
          </Button>
        </div>
      </Field>
      <NewSpaceDialog
        open={newOpen}
        onOpenChange={setNewOpen}
        projectId={projectId}
        venues={ctx.venues}
        defaultVenueId={venueId}
        onCreated={(space) => {
          ctx.addSpace(space);
          onChange({ venueId: space.venueId, spaceId: space.id, space });
        }}
      />
    </div>
  );
}
