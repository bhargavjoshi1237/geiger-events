"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import { BedDouble, BookmarkPlus, CalendarRange, Loader2, Plus, Presentation, Wand2, X } from "lucide-react";

import { EmptyState, Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@geiger/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { applyPreset, presetFromRfp } from "@/lib/sourcing/drafting";
import { SETUP_STYLES, addDays, dayCount, formatDay, roomNights, rowKey } from "@/lib/sourcing/rfp_model";

function RoomsEditor({ rooms, locked, onChange, defaultDays, attendees }) {
  const setRoom = (id, p) => onChange(rooms.map((r) => (r.id === id ? { ...r, ...p } : r)));
  const add = () =>
    onChange([
      ...rooms,
      {
        id: rowKey("room"),
        label: rooms.length ? `Breakout ${rooms.length}` : "General session",
        setupStyle: rooms.length ? "classroom" : "theatre",
        capacity: rooms.length ? Math.max(10, Math.round((attendees || 100) / 4)) : attendees || 0,
        days: defaultDays || 1,
      },
    ]);

  return (
    <div className="space-y-2">
      {rooms.length ? (
        <div className="hidden grid-cols-[minmax(0,1fr)_150px_100px_80px_36px] gap-2 text-xs font-medium text-text-secondary sm:grid">
          <span>Room</span>
          <span>Setup</span>
          <span>Capacity</span>
          <span>Days</span>
          <span />
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface-subtle">
          <EmptyState icon={Presentation} title="No meeting space yet" description="Add the rooms you need, or apply a preset." />
        </div>
      )}
      {rooms.map((r) => (
        <div
          key={r.id}
          className="grid grid-cols-2 gap-2 rounded-lg border border-border p-3 sm:grid-cols-[minmax(0,1fr)_150px_100px_80px_36px] sm:items-center sm:border-0 sm:p-0"
        >
          <Input
            className="col-span-2 sm:col-span-1"
            value={r.label}
            disabled={locked}
            placeholder="Room name"
            aria-label="Room name"
            onChange={(e) => setRoom(r.id, { label: e.target.value })}
          />
          <Select value={r.setupStyle} disabled={locked} onValueChange={(v) => setRoom(r.id, { setupStyle: v })}>
            <SelectTrigger className="w-full bg-surface-card" aria-label="Setup">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {SETUP_STYLES.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="0"
            value={r.capacity || ""}
            disabled={locked}
            placeholder="Capacity"
            aria-label="Capacity"
            className="tabular-nums"
            onChange={(e) => setRoom(r.id, { capacity: Number(e.target.value) || 0 })}
          />
          <Input
            type="number"
            min="0"
            value={r.days || ""}
            disabled={locked}
            placeholder="Days"
            aria-label="Days"
            className="tabular-nums"
            onChange={(e) => setRoom(r.id, { days: Number(e.target.value) || 0 })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={locked}
            aria-label="Remove room"
            onClick={() => onChange(rooms.filter((x) => x.id !== r.id))}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      {!locked ? (
        <Button type="button" variant="outline" size="sm" onClick={add}>
          <Plus className="h-4 w-4" /> Add room
        </Button>
      ) : null}
    </div>
  );
}

function NightsEditor({ sleeping, locked, onChange, startDate, endDate }) {
  const nights = sleeping?.nights || [];
  const [perNight, setPerNight] = useState("");
  const setNight = (i, p) => onChange({ nights: nights.map((n, j) => (j === i ? { ...n, ...p } : n)) });
  // One night before day one through the night before the last day.
  const generate = () => {
    const rooms = Math.max(0, Math.round(Number(perNight) || 0));
    if (!startDate || !rooms) {
      toast.error(startDate ? "Enter the rooms you need per night." : "Set the event dates first.");
      return;
    }
    const count = Math.max(1, dayCount(startDate, endDate));
    onChange({ nights: Array.from({ length: count }, (_, i) => ({ date: addDays(startDate, i - 1), rooms })) });
  };
  const total = roomNights(sleeping);

  return (
    <div className="space-y-3">
      {!locked ? (
        <div className="flex flex-wrap items-end gap-2">
          <Field label="Rooms per night" className="w-40">
            <Input
              type="number"
              min="0"
              value={perNight}
              onChange={(e) => setPerNight(e.target.value)}
              placeholder="e.g. 120"
              className="tabular-nums"
            />
          </Field>
          <Button type="button" variant="outline" onClick={generate}>
            <CalendarRange className="h-4 w-4" /> Fill from event dates
          </Button>
        </div>
      ) : null}
      {nights.map((n, i) => (
        <div key={i} className="grid grid-cols-[1fr_120px_36px] items-center gap-2">
          <Input type="date" value={n.date} disabled={locked} aria-label="Night of" onChange={(e) => setNight(i, { date: e.target.value })} />
          <Input
            type="number"
            min="0"
            value={n.rooms || ""}
            disabled={locked}
            aria-label="Rooms"
            placeholder="Rooms"
            className="tabular-nums"
            onChange={(e) => setNight(i, { rooms: Number(e.target.value) || 0 })}
          />
          <Button
            type="button"
            variant="ghost"
            size="icon"
            disabled={locked}
            aria-label="Remove night"
            onClick={() => onChange({ nights: nights.filter((_, j) => j !== i) })}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      ))}
      <div className="flex flex-wrap items-center justify-between gap-2">
        {!locked ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() =>
              onChange({
                nights: [
                  ...nights,
                  { date: nights.length ? addDays(nights[nights.length - 1].date, 1) : startDate ? addDays(startDate, -1) : "", rooms: nights.at(-1)?.rooms || 0 },
                ],
              })
            }
          >
            <Plus className="h-4 w-4" /> Add night
          </Button>
        ) : (
          <span />
        )}
        <span className="text-xs text-text-secondary">
          {total ? `${total.toLocaleString("en-US")} room nights${nights[0]?.date ? ` from ${formatDay(nights[0].date)}` : ""}` : "No room block"}
        </span>
      </div>
    </div>
  );
}

function SavePresetDialog({ open, onOpenChange, onSave }) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [busy, setBusy] = useState(false);
  const submit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Name the preset.");
      return;
    }
    setBusy(true);
    const ok = await onSave({ name: name.trim(), description: description.trim() });
    setBusy(false);
    if (ok) {
      setName("");
      setDescription("");
      onOpenChange(false);
    }
  };
  return (
    <Dialog open={open} onOpenChange={(o) => !busy && onOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Save as preset</DialogTitle>
            <DialogDescription>
              Reuse these rooms, room block, F&amp;B and AV on future RFPs. Dates are stored relative to day one.
            </DialogDescription>
          </DialogHeader>
          <Field label="Name">
            <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Annual summit · 300 pax · 2 days" />
          </Field>
          <Field label="Description">
            <Input value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Optional" />
          </Field>
          <DialogFooter>
            <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={busy} className="bg-primary text-primary-foreground hover:bg-primary/90">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <BookmarkPlus className="h-4 w-4" />}
              Save preset
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

export function RequirementsSection({ form, patch, locked, presets, onSavePreset }) {
  const [saveOpen, setSaveOpen] = useState(false);
  const days = Math.max(1, dayCount(form.startDate, form.endDate));
  const saved = presets.filter((p) => !String(p.id).startsWith("builtin:"));
  const builtIn = presets.filter((p) => String(p.id).startsWith("builtin:"));

  const apply = (preset) => {
    patch(applyPreset(form, preset));
    toast.success(`Applied "${preset.name}"${form.attendees ? `, scaled to ${form.attendees} attendees` : ""}.`);
  };

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-center gap-2">
        {!locked ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button type="button" variant="outline">
                <Wand2 className="h-4 w-4" /> Apply preset
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-72">
              {saved.length ? (
                <>
                  <DropdownMenuLabel>Your presets</DropdownMenuLabel>
                  {saved.map((p) => (
                    <DropdownMenuItem key={p.id} onSelect={() => apply(p)}>
                      {p.name}
                    </DropdownMenuItem>
                  ))}
                  <DropdownMenuSeparator />
                </>
              ) : null}
              <DropdownMenuLabel>Built in</DropdownMenuLabel>
              {builtIn.map((p) => (
                <DropdownMenuItem key={p.id} onSelect={() => apply(p)}>
                  {p.name}
                </DropdownMenuItem>
              ))}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
        <Button type="button" variant="outline" onClick={() => setSaveOpen(true)}>
          <BookmarkPlus className="h-4 w-4" /> Save as preset
        </Button>
      </div>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 border-b border-border pb-3 text-base font-semibold text-foreground">
          <Presentation className="h-4 w-4 text-text-secondary" /> Meeting space
        </h3>
        <RoomsEditor
          rooms={form.roomRequirements}
          locked={locked}
          defaultDays={days}
          attendees={form.attendees}
          onChange={(roomRequirements) => patch({ roomRequirements })}
        />
      </section>

      <section className="space-y-4">
        <h3 className="flex items-center gap-2 border-b border-border pb-3 text-base font-semibold text-foreground">
          <BedDouble className="h-4 w-4 text-text-secondary" /> Sleeping rooms
        </h3>
        <NightsEditor
          sleeping={form.sleepingRooms}
          locked={locked}
          startDate={form.startDate}
          endDate={form.endDate}
          onChange={(sleepingRooms) => patch({ sleepingRooms })}
        />
      </section>

      <section className="space-y-4">
        <h3 className="border-b border-border pb-3 text-base font-semibold text-foreground">Food, beverage & AV</h3>
        <div className="grid gap-4 sm:grid-cols-[minmax(0,1fr)_200px]">
          <Field label="F&B requirements">
            <Textarea
              rows={3}
              value={form.fnbRequirements}
              disabled={locked}
              onChange={(e) => patch({ fnbRequirements: e.target.value })}
              placeholder="Meals, breaks, receptions, dietary needs…"
            />
          </Field>
          <Field label={`F&B minimum (${form.currency})`} hint="Expected catering spend.">
            <Input
              type="number"
              min="0"
              value={form.fnbMinimum ?? ""}
              disabled={locked}
              className="tabular-nums"
              onChange={(e) => patch({ fnbMinimum: e.target.value === "" ? null : Number(e.target.value) })}
            />
          </Field>
        </div>
        <Field label="AV & production">
          <Textarea
            rows={3}
            value={form.avNeeds}
            disabled={locked}
            onChange={(e) => patch({ avNeeds: e.target.value })}
            placeholder="Stage, screens, microphones, streaming, Wi-Fi…"
          />
        </Field>
      </section>

      <SavePresetDialog
        open={saveOpen}
        onOpenChange={setSaveOpen}
        onSave={(meta) => onSavePreset({ ...meta, requirements: presetFromRfp(form) })}
      />
    </div>
  );
}

export default RequirementsSection;
