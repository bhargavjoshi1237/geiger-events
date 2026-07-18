"use client";

import React, { useState } from "react";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Pencil,
  ArrowUp,
  ArrowDown,
  CalendarClock,
  Clock,
  MapPin,
  Users,
} from "lucide-react";

import { EditorSectionHeader, Field } from "@/components/internal/shared/screen_kit";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useEventConfig } from "@/lib/events/use-event-config";
import { TIME_BANDS, bandLabel, bandFromTime, EMPTY_SLOT } from "@/lib/events/slots";

// Bookable time-slot editor. Slots live in the event metadata bag (metadata.
// slots) with a master metadata.slotBooking config; the public checkout renders
// a slot picker and the buy_ticket RPC enforces each slot's capacity via a
// metadata.slotsSold counter. See lib/events/slots.js for the shape + helpers.

const DEFAULT_BOOKING = { enabled: false, required: true, mode: "single", label: "Choose your time" };

function fmtRange(slot) {
  if (!slot.start) return "No time set";
  const s = new Date(slot.start);
  const opts = { weekday: "short", month: "short", day: "numeric", hour: "numeric", minute: "2-digit" };
  const startStr = Number.isNaN(s.getTime()) ? slot.start : s.toLocaleString(undefined, opts);
  if (!slot.end) return startStr;
  const e = new Date(slot.end);
  const endStr = Number.isNaN(e.getTime())
    ? slot.end
    : e.toLocaleString(undefined, { hour: "numeric", minute: "2-digit" });
  return `${startStr} – ${endStr}`;
}

function SlotDialog({ open, onOpenChange, ticketTypes, initial, onSave }) {
  const [draft, setDraft] = useState(EMPTY_SLOT);
  // Tracks whether the organiser hand-picked a band so we stop auto-syncing it.
  const [bandTouched, setBandTouched] = useState(false);

  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(initial ? { ...EMPTY_SLOT, ...initial } : { ...EMPTY_SLOT });
      setBandTouched(!!initial);
    }
  }

  const set = (key) => (value) => setDraft((d) => ({ ...d, [key]: value }));

  // Auto-suggest the band from the start time until the organiser overrides it.
  const setStart = (value) =>
    setDraft((d) => ({
      ...d,
      start: value,
      band: bandTouched ? d.band : bandFromTime(value),
    }));

  const isAllTickets = draft.allowedTickets === "all";
  const toggleTicket = (id) =>
    setDraft((d) => {
      const cur = Array.isArray(d.allowedTickets) ? d.allowedTickets : [];
      const next = cur.includes(id) ? cur.filter((t) => t !== id) : [...cur, id];
      return { ...d, allowedTickets: next.length ? next : "all" };
    });

  const submit = () => {
    if (!draft.label.trim()) {
      toast.error("Give the slot a name.");
      return;
    }
    if (!draft.start) {
      toast.error("Set a start time for the slot.");
      return;
    }
    onSave({
      label: draft.label.trim(),
      description: draft.description.trim(),
      start: draft.start,
      end: draft.end || "",
      band: draft.band,
      capacity: Number(draft.capacity) || 0,
      priceDelta: Number(draft.priceDelta) || 0,
      allowedTickets: draft.allowedTickets,
      location: draft.location.trim(),
      bookingCutoffHours:
        draft.bookingCutoffHours === "" || draft.bookingCutoffHours == null
          ? null
          : Number(draft.bookingCutoffHours) || null,
      minPerOrder: Number(draft.minPerOrder) || 1,
      maxPerOrder:
        draft.maxPerOrder === "" || draft.maxPerOrder == null
          ? null
          : Number(draft.maxPerOrder) || null,
      waitlist: Boolean(draft.waitlist),
      color: draft.color,
      enabled: Boolean(draft.enabled),
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg overflow-y-auto bg-background">
        <DialogHeader>
          <DialogTitle>{initial ? "Edit slot" : "Add slot"}</DialogTitle>
          <DialogDescription>
            A bookable session buyers choose at checkout. Its time band can gate
            which purchasables appear.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-5">
          <Field label="Name" htmlFor="slot-name">
            <Input
              id="slot-name"
              value={draft.label}
              onChange={(e) => set("label")(e.target.value)}
              placeholder="e.g. Evening seating"
              autoFocus
            />
          </Field>
          <Field label="Description" hint="Optional" htmlFor="slot-desc">
            <Textarea
              id="slot-desc"
              rows={2}
              value={draft.description}
              onChange={(e) => set("description")(e.target.value)}
              placeholder="Shown beneath the slot name at checkout."
            />
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Starts" htmlFor="slot-start">
              <Input
                id="slot-start"
                type="datetime-local"
                value={draft.start}
                onChange={(e) => setStart(e.target.value)}
              />
            </Field>
            <Field label="Ends" hint="Optional" htmlFor="slot-end">
              <Input
                id="slot-end"
                type="datetime-local"
                value={draft.end}
                onChange={(e) => set("end")(e.target.value)}
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Time band" hint="Gates conditional add-ons">
              <Select
                value={draft.band}
                onValueChange={(v) => {
                  setBandTouched(true);
                  set("band")(v);
                }}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TIME_BANDS.map((b) => (
                    <SelectItem key={b.value} value={b.value}>
                      {b.label} · {b.hint}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Capacity" hint="0 = unlimited" htmlFor="slot-cap">
              <Input
                id="slot-cap"
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.capacity}
                onChange={(e) => set("capacity")(e.target.value)}
                className="tabular-nums"
                placeholder="0"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Price adjustment" hint="Added to the ticket price">
              <div className="flex items-center gap-1">
                <span className="text-sm text-text-secondary">$</span>
                <Input
                  type="number"
                  inputMode="decimal"
                  value={draft.priceDelta}
                  onChange={(e) => set("priceDelta")(e.target.value)}
                  className="tabular-nums"
                  placeholder="0"
                />
              </div>
            </Field>
            <Field label="Location" hint="Optional room / area" htmlFor="slot-loc">
              <Input
                id="slot-loc"
                value={draft.location}
                onChange={(e) => set("location")(e.target.value)}
                placeholder="e.g. Rooftop terrace"
              />
            </Field>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Booking cutoff" hint="Hrs before start; blank = none">
              <Input
                type="number"
                min={0}
                inputMode="numeric"
                value={draft.bookingCutoffHours ?? ""}
                onChange={(e) => set("bookingCutoffHours")(e.target.value)}
                className="tabular-nums"
                placeholder="e.g. 24"
              />
            </Field>
            <Field label="Max per order" hint="Blank = no limit">
              <Input
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.maxPerOrder ?? ""}
                onChange={(e) => set("maxPerOrder")(e.target.value)}
                className="tabular-nums"
                placeholder="No limit"
              />
            </Field>
          </div>

          <Field label="Bookable with">
            <p className="-mt-0.5 text-xs text-text-secondary">
              Which ticket types can book this slot.
            </p>
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={() => set("allowedTickets")("all")}
                className={cn(
                  "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                  isAllTickets
                    ? "border-white bg-white text-[#161616]"
                    : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                )}
              >
                All tickets
              </button>
              {ticketTypes.map((t) => {
                const active =
                  !isAllTickets &&
                  Array.isArray(draft.allowedTickets) &&
                  draft.allowedTickets.includes(t.id);
                return (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => toggleTicket(t.id)}
                    className={cn(
                      "rounded-full border px-3 py-1.5 text-xs font-medium transition-colors",
                      active
                        ? "border-white bg-white text-[#161616]"
                        : "border-border bg-surface-card text-muted-foreground hover:bg-surface-active",
                    )}
                  >
                    {t.name}
                  </button>
                );
              })}
            </div>
          </Field>

          <div className="grid gap-3 rounded-xl border border-border bg-surface-card p-3">
            <label className="flex items-center justify-between text-sm text-muted-foreground">
              Offer a waitlist when full
              <Switch checked={draft.waitlist} onCheckedChange={(v) => set("waitlist")(v)} />
            </label>
            <label className="flex items-center justify-between text-sm text-muted-foreground">
              Slot available
              <Switch checked={draft.enabled} onCheckedChange={(v) => set("enabled")(v)} />
            </label>
          </div>
        </div>

        <DialogFooter>
          <Button
            variant="outline"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onOpenChange(false)}
          >
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={submit}
          >
            {initial ? "Save slot" : "Add slot"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function SlotsSection({ event, headerItem }) {
  const [slots, , saveSlots] = useEventConfig(event, "slots", []);
  const [booking, , saveBooking] = useEventConfig(event, "slotBooking", DEFAULT_BOOKING);
  const [addOpen, setAddOpen] = useState(false);
  const [editing, setEditing] = useState(null); // { index, slot } | null

  const cfg = { ...DEFAULT_BOOKING, ...(booking || {}) };
  const slotsSold = event.slotsSold || {};

  // Ticket tiers (id + name) so the "bookable with" chips key on the stable id.
  const ticketTypes = (Array.isArray(event.tickets) ? event.tickets : [])
    .filter((t) => t && t.id)
    .map((t) => ({ id: String(t.id), name: t.name || "Untitled" }));

  const patchBooking = (patch, opts) => saveBooking({ ...cfg, ...patch }, opts);

  const addSlot = (slot) =>
    saveSlots([...slots, { ...slot, id: `slot_${Date.now()}` }], { successMsg: "Slot added." });
  const updateSlot = (index, slot) =>
    saveSlots(
      slots.map((s, i) => (i === index ? { ...s, ...slot } : s)),
      { successMsg: "Slot updated." },
    );
  const removeSlot = (index) =>
    saveSlots(slots.filter((_, i) => i !== index), { successMsg: "Slot removed." });
  const toggleEnabled = (index) =>
    saveSlots(slots.map((s, i) => (i === index ? { ...s, enabled: !(s.enabled !== false) } : s)));
  const move = (index, dir) => {
    const ni = index + dir;
    if (ni < 0 || ni >= slots.length) return;
    const copy = [...slots];
    [copy[index], copy[ni]] = [copy[ni], copy[index]];
    saveSlots(copy);
  };

  return (
    <div className="space-y-6">
      <EditorSectionHeader
        title={headerItem?.label || "Slots"}
        description={
          headerItem?.desc ||
          "Let buyers book a time slot at checkout — each with its own capacity, price, and rules."
        }
        action={
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            onClick={() => setAddOpen(true)}
            disabled={!cfg.enabled}
          >
            <Plus className="h-4 w-4" /> Add slot
          </Button>
        }
      />

      {/* Master booking config. */}
      <div className="space-y-4 rounded-xl border border-border bg-surface-card p-4">
        <label className="flex items-start justify-between gap-4">
          <span>
            <span className="block text-sm font-medium text-foreground">Allow slot booking</span>
            <span className="mt-0.5 block text-xs text-text-secondary">
              Buyers must pick one of your slots as part of checkout.
            </span>
          </span>
          <Switch
            checked={cfg.enabled}
            onCheckedChange={(v) =>
              patchBooking({ enabled: v }, { successMsg: v ? "Slot booking on." : "Slot booking off." })
            }
          />
        </label>
        {cfg.enabled ? (
          <div className="grid gap-4 border-t border-border pt-4 sm:grid-cols-2">
            <Field label="Picker label" htmlFor="slot-picker-label">
              <Input
                id="slot-picker-label"
                value={cfg.label}
                onChange={(e) => patchBooking({ label: e.target.value })}
                onBlur={() => patchBooking({})}
                placeholder="Choose your time"
              />
            </Field>
            <Field label="Requirement">
              <label className="flex h-9 items-center justify-between rounded-md border border-border bg-surface-card px-3 text-sm text-muted-foreground">
                Require a slot to check out
                <Switch
                  checked={cfg.required !== false}
                  onCheckedChange={(v) => patchBooking({ required: v })}
                />
              </label>
            </Field>
          </div>
        ) : null}
      </div>

      {!cfg.enabled ? null : slots.length ? (
        <div className="space-y-3">
          {slots.map((raw, i) => {
            const s = { ...EMPTY_SLOT, ...raw };
            const enabled = s.enabled !== false;
            const cap = Number(s.capacity) || 0;
            const sold = Number(slotsSold[s.id]) || 0;
            return (
              <div
                key={s.id || i}
                className={cn(
                  "rounded-xl border border-border bg-surface-card p-4 transition-opacity",
                  enabled ? "" : "opacity-60",
                )}
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg border border-border bg-surface-subtle text-muted-foreground">
                    <CalendarClock className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground">{s.label}</p>
                    <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-text-secondary">
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" /> {fmtRange(s)}
                      </span>
                      {s.location ? (
                        <span className="inline-flex items-center gap-1">
                          <MapPin className="h-3 w-3" /> {s.location}
                        </span>
                      ) : null}
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Users className="h-3 w-3" />
                        {cap > 0 ? `${sold}/${cap}` : "Unlimited"}
                      </span>
                    </p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-2 self-stretch">
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <Badge variant="neutral">{bandLabel(s.band)}</Badge>
                      {Number(s.priceDelta) ? (
                        <Badge variant="success">
                          {Number(s.priceDelta) > 0 ? `+$${Number(s.priceDelta)}` : `-$${Math.abs(Number(s.priceDelta))}`}
                        </Badge>
                      ) : null}
                      {s.waitlist ? <Badge variant="warning">Waitlist</Badge> : null}
                    </div>
                    <div className="flex flex-1 items-center">
                      <Switch
                        checked={enabled}
                        onCheckedChange={() => toggleEnabled(i)}
                        aria-label={enabled ? "Disable slot" : "Enable slot"}
                      />
                    </div>
                  </div>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3 border-t border-border pt-3">
                  <p className="min-w-0 truncate text-xs text-text-tertiary">
                    {s.description || " "}
                  </p>
                  <div className="flex shrink-0 items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={i === 0}
                      onClick={() => move(i, -1)}
                      aria-label="Move up"
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowUp className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      disabled={i === slots.length - 1}
                      onClick={() => move(i, 1)}
                      aria-label="Move down"
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground disabled:opacity-30"
                    >
                      <ArrowDown className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => setEditing({ index: i, slot: s })}
                      aria-label="Edit slot"
                      className="text-text-secondary hover:bg-surface-active hover:text-foreground"
                    >
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon-sm"
                      onClick={() => removeSlot(i)}
                      aria-label="Delete slot"
                      className="text-text-secondary hover:bg-red-500/10 hover:text-red-400"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAddOpen(true)}
          className="flex w-full flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border bg-surface-card py-10 text-text-secondary transition-colors hover:border-border-strong hover:text-muted-foreground"
        >
          <CalendarClock className="h-6 w-6" />
          <p className="text-sm">Create your first slot</p>
        </button>
      )}

      <SlotDialog
        open={addOpen}
        onOpenChange={setAddOpen}
        ticketTypes={ticketTypes}
        onSave={addSlot}
      />
      <SlotDialog
        open={!!editing}
        onOpenChange={(o) => !o && setEditing(null)}
        ticketTypes={ticketTypes}
        initial={editing?.slot}
        onSave={(slot) => {
          updateSlot(editing.index, slot);
          setEditing(null);
        }}
      />
    </div>
  );
}

export default SlotsSection;
