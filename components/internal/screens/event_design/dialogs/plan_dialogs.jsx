"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { Check, Loader2, Trash2 } from "lucide-react";

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
import { TEMPLATE_CATEGORIES } from "../constants";
import { EventSelect } from "../fields";
import { SpacePicker } from "./space_picker";

// Small plan dialogs: attach to an event, save as template / add to a venue library, and delete confirmation.

export function AttachEventDialog({ plan, events, onOpenChange, onSave }) {
  const [eventId, setEventId] = useState(plan?.eventId ?? null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setBusy(true);
    const ok = await onSave(eventId);
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={!!plan} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Attach to an event</DialogTitle>
          <DialogDescription>
            The plan shows up against this event, and the event&apos;s team can find its layout.
          </DialogDescription>
        </DialogHeader>
        <Field label="Event">
          <EventSelect events={events} value={eventId} onChange={setEventId} />
        </Field>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            Save
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// mode "template": name + category. mode "library": name + the venue space it belongs to.
export function SaveAsDialog({ open, onOpenChange, mode, initial, ctx, projectId, title, description, submitLabel, onSubmit }) {
  const [draft, setDraft] = useState(null);
  const [busy, setBusy] = useState(false);
  const [seeded, setSeeded] = useState(false);
  if (open && !seeded) {
    setSeeded(true);
    setDraft({
      name: initial?.name || "",
      templateCategory: initial?.templateCategory || TEMPLATE_CATEGORIES[0],
      venueId: initial?.venueId || null,
      venueSpaceId: initial?.venueSpaceId || null,
    });
  } else if (!open && seeded) {
    setSeeded(false);
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  const categories = draft?.templateCategory && !TEMPLATE_CATEGORIES.includes(draft.templateCategory)
    ? [...TEMPLATE_CATEGORIES, draft.templateCategory]
    : TEMPLATE_CATEGORIES;

  const submit = async () => {
    if (!draft.name.trim()) {
      toast.error("Give it a name first.");
      return;
    }
    if (mode === "library" && !draft.venueSpaceId) {
      toast.error("Pick the venue space this diagram belongs to.");
      return;
    }
    setBusy(true);
    const ok = await onSubmit({ ...draft, name: draft.name.trim() });
    setBusy(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        {draft ? (
          <div className="grid gap-4">
            <Field label="Name">
              <Input autoFocus value={draft.name} onChange={(e) => set("name")(e.target.value)} />
            </Field>
            {mode === "template" ? (
              <Field label="Category">
                <Select value={draft.templateCategory} onValueChange={set("templateCategory")}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c) => (
                      <SelectItem key={c} value={c}>
                        {c}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
            ) : (
              <SpacePicker
                ctx={ctx}
                projectId={projectId}
                venueId={draft.venueId}
                spaceId={draft.venueSpaceId}
                requireSpace
                onChange={({ venueId, spaceId }) => setDraft((d) => ({ ...d, venueId, venueSpaceId: spaceId }))}
              />
            )}
          </div>
        ) : null}
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={busy} onClick={submit}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function ConfirmDeleteDialog({ target, title, children, onOpenChange, onConfirm }) {
  return (
    <Dialog open={!!target} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{children}</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-red-500/90 text-white hover:bg-red-500"
            onClick={() => {
              onConfirm(target);
              onOpenChange(false);
            }}
          >
            <Trash2 className="h-4 w-4" /> Delete
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
