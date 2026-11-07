"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { FileText, Loader2, Plus } from "lucide-react";

import { Field } from "@/components/internal/shared/screen_kit";
import { Badge } from "@geiger/ui/badge";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { applyPreset, blankDraft, draftFromEvent, expectedAttendees } from "@/lib/sourcing/drafting";
import { formatDay, isEmail } from "@/lib/sourcing/rfp_model";

const NONE = "none";

// Event first (dates, headcount, city), then the preset's requirements scaled to that headcount.
function buildDraft(event, preset) {
  const now = Date.now();
  const draft = event ? draftFromEvent(event, { now }) : blankDraft({ now });
  return preset ? { ...draft, ...applyPreset(draft, preset) } : draft;
}

// New RFP: optionally seeded from an event (dates, headcount, city) and a requirements preset.
// `recipients` are venues handed over from Venue Sourcing, added once the RFP exists.
export function CreateRfpDialog({ open, onOpenChange, events, presets, onCreate, recipients = null }) {
  const noEmail = (recipients || []).filter((r) => !isEmail(r.email)).length;
  const [eventId, setEventId] = useState(NONE);
  const [presetId, setPresetId] = useState(NONE);
  const [title, setTitle] = useState("");
  const [busy, setBusy] = useState(false);

  const event = events.find((e) => e.id === eventId) || null;
  const preset = presets.find((p) => p.id === presetId) || null;

  const reset = () => {
    setEventId(NONE);
    setPresetId(NONE);
    setTitle("");
  };

  const close = (o) => {
    if (busy) return;
    if (!o) reset();
    onOpenChange(o);
  };

  const submit = async (e) => {
    e.preventDefault();
    const draft = buildDraft(event, preset);
    const name = title.trim() || draft.title;
    if (!name) {
      toast.error("Give the RFP a title, or start it from an event.");
      return;
    }
    setBusy(true);
    const ok = await onCreate({ ...draft, title: name });
    setBusy(false);
    if (ok) {
      reset();
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-lg gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">New RFP</DialogTitle>
            <DialogDescription className="text-xs">
              Start from an event and a preset to prefill the brief — you can change everything after.
            </DialogDescription>
          </div>
        </DialogHeader>

        <form onSubmit={submit}>
          <div className="grid gap-4 p-5">
            <Field
              label="Event"
              hint={
                event
                  ? `${event.date ? formatDay(event.date) : "No date yet"} · ${expectedAttendees(event) || "no"} expected attendees${event.city ? ` · ${event.city}` : ""}`
                  : "Optional — prefills dates, headcount and location."
              }
            >
              <Select value={eventId} onValueChange={setEventId}>
                <SelectTrigger className="w-full bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No event — start from scratch</SelectItem>
                  {events.map((ev) => (
                    <SelectItem key={ev.id} value={ev.id}>
                      {ev.name || "Untitled event"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field
              label="Requirements preset"
              hint={preset ? preset.description || "Saved preset" : "Optional — meeting rooms, room block, F&B and AV in one go."}
            >
              <Select value={presetId} onValueChange={setPresetId}>
                <SelectTrigger className="w-full bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No preset</SelectItem>
                  {presets.map((p) => (
                    <SelectItem key={p.id} value={p.id}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Title">
              <Input
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder={event?.name ? `${event.name} — venue proposal` : "e.g. Spring summit venue"}
                className="bg-surface-card"
              />
            </Field>

            {recipients?.length ? (
              <Field
                label={`Recipients · ${recipients.length} from Venue Sourcing`}
                hint={
                  noEmail
                    ? `${noEmail} without an email — add one in Recipients before sending.`
                    : "Added when the RFP is created — you can change them before sending."
                }
              >
                <div className="flex flex-wrap gap-1.5">
                  {recipients.map((r) => (
                    <Badge key={r.pipelineRecordId || r.venueId || r.name} variant="neutral">
                      {r.name}
                    </Badge>
                  ))}
                </div>
              </Field>
            ) : null}
          </div>

          <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
            <Button
              type="button"
              variant="ghost"
              className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
              onClick={() => close(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create RFP
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export default CreateRfpDialog;
