"use client";

import React, { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CalendarOff, DoorOpen, Loader2, Plus, Trash2 } from "lucide-react";

import {
  EmptyState,
  Field,
  SectionCard,
  StatusPill,
} from "@/components/internal/shared/screen_kit";
import {
  ActionMenu,
  Button,
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  Input,
  LogoLoading,
  SegmentedTabs,
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
  Switch,
  Textarea,
} from "@geiger/ui";
import { useOptionalProject } from "@/context/project-context";
import { getUser } from "@/lib/supabase/user";
import {
  METRES_PER_FOOT,
  SPACE_KINDS,
  createVenueSpace,
  listVenueSpaces,
  softDeleteVenueSpace,
  spaceAreaM2,
  updateVenueSpace,
} from "@/lib/supabase/venue_spaces";
import { BOOKING_CURRENCIES, SETUP_STYLES, capacityFor } from "@/lib/venue_booking/styles";
import { OPENING_DAYS, dayWindow, hasOpeningHours } from "@/lib/venue_booking/availability";
import { HALF_DAY_HOURS, hasRates, rateSummary } from "@/lib/venue_booking/pricing";
import { clockString, parseClock, todayIn } from "@/lib/venue_booking/time";
import { EventDatePicker } from "@/components/internal/screens/events/date_time_fields";

// The rooms inside a venue (ballroom, breakout A, terrace): size, capacity per setup, and the
// rate card / opening hours / blackouts Instant Book books against.

const BOOKABLE_MAP = {
  Bookable: { label: "Instant Book", variant: "success", dotClass: "bg-emerald-400" },
  Off: { label: "Not bookable", variant: "muted", dotClass: "bg-text-tertiary" },
};

const KIND_LABELS = {
  room: "Room",
  hall: "Hall",
  ballroom: "Ballroom",
  outdoor: "Outdoor",
  suite: "Suite",
  other: "Other",
};

// Every half hour, with 24:00 for "until midnight".
const TIME_OPTIONS = Array.from({ length: 49 }, (_, i) => clockString(i * 30));

const DEFAULT_DAY = { open: true, from: "08:00", to: "22:00" };

const toDisplay = (metres, unit) => {
  if (metres == null || metres === "") return "";
  const v = unit === "ft" ? Number(metres) / METRES_PER_FOOT : Number(metres);
  return Number.isFinite(v) ? String(Math.round(v * 100) / 100) : "";
};

const toMetres = (value, unit) => {
  if (value === "" || value == null) return null;
  const v = Number(value);
  if (!Number.isFinite(v) || v < 0) return null;
  return Math.round((unit === "ft" ? v * METRES_PER_FOOT : v) * 100) / 100;
};

const numText = (v) => (v == null ? "" : String(v));

function draftFrom(space) {
  const unit = space.unit === "ft" ? "ft" : "m";
  const hours = {};
  for (const d of OPENING_DAYS) {
    const win = dayWindow(space.openingHours, d.key);
    hours[d.key] = win
      ? { open: true, from: clockString(win.open), to: clockString(win.close) }
      : { open: false, from: DEFAULT_DAY.from, to: DEFAULT_DAY.to };
  }
  return {
    name: space.name || "",
    kind: space.kind || "room",
    floor: space.floor || "",
    description: space.description || "",
    unit,
    width: toDisplay(space.widthM, unit),
    length: toDisplay(space.lengthM, unit),
    height: toDisplay(space.heightM, unit),
    capacities: Object.fromEntries(SETUP_STYLES.map((s) => [s.key, numText(space.capacities?.[s.key] || null)])),
    bookable: space.bookable === true,
    currency: space.currency || "GBP",
    rateHourly: numText(space.rateHourly),
    rateHalfDay: numText(space.rateHalfDay),
    rateFullDay: numText(space.rateFullDay),
    minHours: numText(space.minHours ?? 1),
    bufferMinutes: numText(space.bufferMinutes ?? 0),
    hoursEnabled: hasOpeningHours(space.openingHours),
    hours,
    blackouts: (space.blackoutDates || []).map((b, i) => ({
      key: `${b.from}-${i}`,
      from: b.from || "",
      to: b.to || b.from || "",
      reason: b.reason || "",
    })),
  };
}

// Draft -> patch for updateVenueSpace, or { error } when something needs fixing first.
function patchFrom(draft) {
  if (!draft.name.trim()) return { error: "Give the space a name." };
  const capacities = {};
  for (const s of SETUP_STYLES) {
    const n = Math.round(Number(draft.capacities[s.key]));
    if (Number.isFinite(n) && n > 0) capacities[s.key] = n;
  }
  const rate = (v) => (v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));
  const rates = { rateHourly: rate(draft.rateHourly), rateHalfDay: rate(draft.rateHalfDay), rateFullDay: rate(draft.rateFullDay) };
  if (draft.bookable && !hasRates({ hourly: rates.rateHourly, halfDay: rates.rateHalfDay, fullDay: rates.rateFullDay })) {
    return { error: "Add at least one rate before switching on Instant Book." };
  }
  let openingHours = {};
  if (draft.hoursEnabled) {
    for (const d of OPENING_DAYS) {
      const day = draft.hours[d.key];
      if (!day.open) {
        openingHours[d.key] = { closed: true };
        continue;
      }
      if ((parseClock(day.to) ?? 0) <= (parseClock(day.from) ?? 0)) {
        return { error: `${d.label} closes before it opens.` };
      }
      openingHours[d.key] = { open: day.from, close: day.to };
    }
    if (OPENING_DAYS.every((d) => !draft.hours[d.key].open)) return { error: "Open the space on at least one day." };
  }
  const blackoutDates = [];
  for (const b of draft.blackouts) {
    if (!b.from) continue;
    const to = b.to && b.to >= b.from ? b.to : b.from;
    blackoutDates.push({ from: b.from, to, reason: b.reason.trim() });
  }
  blackoutDates.sort((a, b) => a.from.localeCompare(b.from));
  return {
    patch: {
      name: draft.name.trim(),
      kind: draft.kind,
      floor: draft.floor.trim(),
      description: draft.description,
      unit: draft.unit,
      widthM: toMetres(draft.width, draft.unit),
      lengthM: toMetres(draft.length, draft.unit),
      heightM: toMetres(draft.height, draft.unit),
      capacities,
      bookable: draft.bookable,
      currency: draft.currency,
      ...rates,
      minHours: Math.max(0, Number(draft.minHours) || 0),
      bufferMinutes: Math.max(0, Math.round(Number(draft.bufferMinutes) || 0)),
      openingHours,
      blackoutDates,
    },
  };
}

function NewSpaceDialog({ open, onOpenChange, onCreate }) {
  const [draft, setDraft] = useState({ name: "", kind: "room" });

  const close = (next) => {
    if (!next) setDraft({ name: "", kind: "room" });
    onOpenChange(next);
  };

  const submit = () => {
    if (!draft.name.trim()) {
      toast.error("Give the space a name first.");
      return;
    }
    onCreate(draft);
    close(false);
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="max-w-md gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <DoorOpen className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">New space</DialogTitle>
            <DialogDescription className="text-xs">
              A room or area inside this venue that can be planned and booked.
            </DialogDescription>
          </div>
        </DialogHeader>
        <form
          onSubmit={(e) => {
            e.preventDefault();
            submit();
          }}
        >
          <div className="grid gap-4 p-5">
            <Field label="Name">
              <Input
                autoFocus
                value={draft.name}
                onChange={(e) => setDraft((d) => ({ ...d, name: e.target.value }))}
                placeholder="e.g. Ballroom, Breakout A"
              />
            </Field>
            <Field label="Kind">
              <Select value={draft.kind} onValueChange={(v) => setDraft((d) => ({ ...d, kind: v }))}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPACE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k] || k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
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
            <Button type="submit" className="bg-primary text-primary-foreground hover:bg-primary/90">
              <Plus className="h-4 w-4" /> Create
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function TimeSelect({ value, onChange, disabled, label }) {
  return (
    <Select value={value} onValueChange={onChange} disabled={disabled}>
      <SelectTrigger aria-label={label} className="w-full sm:w-28">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {TIME_OPTIONS.map((t) => (
          <SelectItem key={t} value={t}>
            {t === "24:00" ? "Midnight" : t}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function SpaceEditor({ space, venue, onBack, onSaved, onDelete }) {
  const [draft, setDraft] = useState(() => draftFrom(space));
  const [saving, setSaving] = useState(false);
  const set = (partial) => setDraft((d) => ({ ...d, ...partial }));
  const setDay = (key, partial) => setDraft((d) => ({ ...d, hours: { ...d.hours, [key]: { ...d.hours[key], ...partial } } }));
  const setBlackout = (key, partial) =>
    setDraft((d) => ({ ...d, blackouts: d.blackouts.map((b) => (b.key === key ? { ...b, ...partial } : b)) }));

  const switchUnit = (unit) => {
    if (unit === draft.unit) return;
    const convert = (v) => toDisplay(toMetres(v, draft.unit), unit);
    set({ unit, width: convert(draft.width), length: convert(draft.length), height: convert(draft.height) });
  };

  const area = useMemo(() => {
    const w = toMetres(draft.width, draft.unit);
    const l = toMetres(draft.length, draft.unit);
    if (!w || !l) return "";
    const m2 = w * l;
    return draft.unit === "ft"
      ? `${Math.round(m2 / (METRES_PER_FOOT * METRES_PER_FOOT)).toLocaleString()} sq ft`
      : `${Math.round(m2).toLocaleString()} m²`;
  }, [draft.width, draft.length, draft.unit]);

  const save = async () => {
    const res = patchFrom(draft);
    if (res.error) {
      toast.error(res.error);
      return;
    }
    setSaving(true);
    const saved = await updateVenueSpace(space.id, res.patch);
    setSaving(false);
    if (!saved) {
      toast.error("Couldn't save the space.");
      return;
    }
    toast.success("Space saved.");
    onSaved(saved);
  };

  const addBlackout = () => {
    const today = todayIn(venue?.timezone);
    setDraft((d) => ({
      ...d,
      blackouts: [...d.blackouts, { key: `new-${Date.now()}`, from: today, to: today, reason: "" }],
    }));
  };

  const currencySymbol = draft.currency;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={onBack}
          className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All spaces
        </Button>
        <div className="flex items-center gap-2">
          <ActionMenu
            label={`Actions for ${draft.name || "space"}`}
            items={[{ icon: Trash2, label: "Delete space", variant: "destructive", onSelect: () => onDelete(space) }]}
          />
          <Button className="bg-primary text-primary-foreground hover:bg-primary/90" disabled={saving} onClick={save}>
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {saving ? "Saving…" : "Save space"}
          </Button>
        </div>
      </div>

      <SectionCard title="Space details">
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Name" className="sm:col-span-1">
              <Input value={draft.name} onChange={(e) => set({ name: e.target.value })} placeholder="e.g. Ballroom" />
            </Field>
            <Field label="Kind">
              <Select value={draft.kind} onValueChange={(v) => set({ kind: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SPACE_KINDS.map((k) => (
                    <SelectItem key={k} value={k}>
                      {KIND_LABELS[k] || k}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Floor">
              <Input value={draft.floor} onChange={(e) => set({ floor: e.target.value })} placeholder="e.g. Level 2" />
            </Field>
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-sm font-medium text-foreground">Dimensions</span>
              <SegmentedTabs
                tabs={[
                  { value: "m", label: "Metres" },
                  { value: "ft", label: "Feet" },
                ]}
                value={draft.unit}
                onChange={switchUnit}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-3">
              {[
                ["width", "Width"],
                ["length", "Length"],
                ["height", "Ceiling height"],
              ].map(([key, label]) => (
                <Field key={key} label={`${label} (${draft.unit})`}>
                  <Input
                    type="number"
                    min={0}
                    step="0.1"
                    value={draft[key]}
                    onChange={(e) => set({ [key]: e.target.value })}
                    placeholder="—"
                  />
                </Field>
              ))}
            </div>
            {area ? <p className="text-xs text-text-secondary">Floor area {area}</p> : null}
          </div>
          <Field label="Description">
            <Textarea
              rows={3}
              value={draft.description}
              onChange={(e) => set({ description: e.target.value })}
              placeholder="Natural light, built-in AV, step-free access…"
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Capacity by setup" description="The most people the space holds in each layout. Leave a style empty if it isn't offered.">
        <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-4">
          {SETUP_STYLES.map((s) => (
            <Field key={s.key} label={s.label}>
              <Input
                type="number"
                min={0}
                value={draft.capacities[s.key]}
                onChange={(e) => set({ capacities: { ...draft.capacities, [s.key]: e.target.value } })}
                placeholder="—"
              />
            </Field>
          ))}
        </div>
      </SectionCard>

      <SectionCard
        title="Instant Book"
        description="Publish a rate card so organisers can book this space on the spot. Prices are always worked out on the server from these rates."
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">{draft.bookable ? "Bookable" : "Off"}</span>
            <Switch checked={draft.bookable} onCheckedChange={(v) => set({ bookable: v })} aria-label="Instant Book" />
          </div>
        }
      >
        <div className="grid gap-4">
          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Currency">
              <Select value={draft.currency} onValueChange={(v) => set({ currency: v })}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {BOOKING_CURRENCIES.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label={`Hourly (${currencySymbol})`}>
              <Input type="number" min={0} step="0.01" value={draft.rateHourly} onChange={(e) => set({ rateHourly: e.target.value })} placeholder="—" />
            </Field>
            <Field label={`Half day, ${HALF_DAY_HOURS} h (${currencySymbol})`}>
              <Input type="number" min={0} step="0.01" value={draft.rateHalfDay} onChange={(e) => set({ rateHalfDay: e.target.value })} placeholder="—" />
            </Field>
            <Field label={`Full day (${currencySymbol})`}>
              <Input type="number" min={0} step="0.01" value={draft.rateFullDay} onChange={(e) => set({ rateFullDay: e.target.value })} placeholder="—" />
            </Field>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Minimum booking (hours)">
              <Input type="number" min={0} step="0.5" value={draft.minHours} onChange={(e) => set({ minHours: e.target.value })} />
            </Field>
            <Field label="Cleaning / turnover buffer (minutes)" hint="Kept free after every booking.">
              <Input type="number" min={0} step="15" value={draft.bufferMinutes} onChange={(e) => set({ bufferMinutes: e.target.value })} />
            </Field>
          </div>
          <p className="text-xs text-text-secondary">
            Each day is charged the cheapest of a full day, half days or hourly. Leave a rate empty if it isn&apos;t offered.
          </p>
        </div>
      </SectionCard>

      <SectionCard
        title="Opening hours"
        description={draft.hoursEnabled ? "Bookings must start and end inside these hours." : "Open around the clock, every day."}
        action={
          <div className="flex items-center gap-2">
            <span className="text-sm text-text-secondary">Set hours</span>
            <Switch checked={draft.hoursEnabled} onCheckedChange={(v) => set({ hoursEnabled: v })} aria-label="Set opening hours" />
          </div>
        }
      >
        {draft.hoursEnabled ? (
          <ul className="divide-y divide-border">
            {OPENING_DAYS.map((d) => {
              const day = draft.hours[d.key];
              return (
                <li key={d.key} className="flex flex-wrap items-center gap-3 py-2.5 first:pt-0 last:pb-0">
                  <span className="w-24 text-sm font-medium text-foreground">{d.label}</span>
                  <Switch checked={day.open} onCheckedChange={(v) => setDay(d.key, { open: v })} aria-label={`Open on ${d.label}`} />
                  {day.open ? (
                    <div className="flex flex-1 items-center gap-2">
                      <TimeSelect label={`${d.label} opens`} value={day.from} onChange={(v) => setDay(d.key, { from: v })} />
                      <span className="text-xs text-text-tertiary">to</span>
                      <TimeSelect label={`${d.label} closes`} value={day.to} onChange={(v) => setDay(d.key, { to: v })} />
                    </div>
                  ) : (
                    <span className="text-sm text-text-secondary">Closed</span>
                  )}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-text-secondary">
            Switch on <span className="text-foreground">Set hours</span> to limit bookings to opening times.
          </p>
        )}
      </SectionCard>

      <SectionCard
        title="Blackout dates"
        description="Days the space can't be booked — maintenance, holidays, private use."
        action={
          <Button
            size="sm"
            variant="outline"
            onClick={addBlackout}
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
          >
            <Plus className="h-4 w-4" /> Add dates
          </Button>
        }
      >
        {draft.blackouts.length ? (
          <ul className="space-y-3">
            {draft.blackouts.map((b) => (
              <li key={b.key} className="grid items-end gap-3 sm:grid-cols-[1fr_1fr_1.5fr_auto]">
                <Field label="From">
                  <EventDatePicker value={b.from} onChange={(v) => setBlackout(b.key, { from: v, to: b.to && b.to >= v ? b.to : v })} />
                </Field>
                <Field label="To">
                  <EventDatePicker value={b.to} onChange={(v) => setBlackout(b.key, { to: v })} />
                </Field>
                <Field label="Reason">
                  <Input value={b.reason} onChange={(e) => setBlackout(b.key, { reason: e.target.value })} placeholder="e.g. Refurbishment" />
                </Field>
                <Button
                  variant="outline"
                  size="icon"
                  aria-label="Remove blackout"
                  onClick={() => set({ blackouts: draft.blackouts.filter((x) => x.key !== b.key) })}
                  className="border-border bg-transparent text-red-700 dark:text-red-300 hover:bg-red-500/10"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex items-center gap-2 text-sm text-text-secondary">
            <CalendarOff className="h-4 w-4" /> No blackout dates.
          </div>
        )}
      </SectionCard>
    </div>
  );
}

function spaceMeta(space) {
  const area = spaceAreaM2(space);
  const cap = capacityFor(space);
  return [
    KIND_LABELS[space.kind] || space.kind,
    space.floor,
    area ? `${Math.round(area).toLocaleString()} m²` : "",
    cap ? `up to ${cap.toLocaleString()}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
}

export function VenueSpacesSection({ venue }) {
  const projectId = useOptionalProject()?.projectId ?? venue?.projectId ?? null;
  const [spaces, setSpaces] = useState([]);
  const [loading, setLoading] = useState(true);
  const [openId, setOpenId] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [userId, setUserId] = useState(null);
  const [reloadToken, setReloadToken] = useState(0);
  const reload = () => setReloadToken((t) => t + 1);

  useEffect(() => {
    if (!venue?.id || !projectId) return undefined;
    let alive = true;
    listVenueSpaces(projectId, { venueId: venue.id }).then((rows) => {
      if (!alive) return;
      setSpaces(rows ?? []);
      setLoading(false);
    });
    getUser().then((u) => alive && setUserId(u?.id || null));
    return () => {
      alive = false;
    };
  }, [venue?.id, projectId, reloadToken]);

  const openSpace = useMemo(() => spaces.find((s) => s.id === openId) || null, [spaces, openId]);

  const handleCreate = async (draft) => {
    if (!projectId) {
      toast.error("Open a project first.");
      return;
    }
    const created = await createVenueSpace({
      projectId,
      venueId: venue.id,
      name: draft.name.trim(),
      kind: draft.kind,
      sortOrder: spaces.length,
      createdBy: userId,
    });
    if (!created) {
      toast.error("Couldn't create the space.");
      return;
    }
    setSpaces((prev) => [...prev, created]);
    setOpenId(created.id);
    toast.success("Space created.");
  };

  const handleBookable = async (space, bookable) => {
    if (bookable && !hasRates({ hourly: space.rateHourly, halfDay: space.rateHalfDay, fullDay: space.rateFullDay })) {
      setOpenId(space.id);
      toast.error("Add a rate first, then switch on Instant Book.");
      return;
    }
    setSpaces((prev) => prev.map((s) => (s.id === space.id ? { ...s, bookable } : s)));
    const saved = await updateVenueSpace(space.id, { bookable });
    if (!saved) {
      toast.error("Couldn't update the space.");
      reload();
    }
  };

  const handleDelete = async (space) => {
    setDeleteTarget(null);
    setOpenId(null);
    setSpaces((prev) => prev.filter((s) => s.id !== space.id));
    const ok = await softDeleteVenueSpace(space.id);
    if (!ok) {
      toast.error("Couldn't delete the space.");
      reload();
      return;
    }
    toast.success("Space deleted.");
  };

  if (loading && projectId) {
    return (
      <div className="flex h-40 items-center justify-center text-text-secondary">
        <LogoLoading size={40} />
      </div>
    );
  }

  return (
    <>
      {openSpace ? (
        <SpaceEditor
          key={openSpace.id}
          space={openSpace}
          venue={venue}
          onBack={() => setOpenId(null)}
          onSaved={(saved) => setSpaces((prev) => prev.map((s) => (s.id === saved.id ? saved : s)))}
          onDelete={setDeleteTarget}
        />
      ) : (
        <SectionCard
          title="Spaces & booking"
          description="The rooms inside this venue, their capacity per setup, and the rates Instant Book books against."
          action={
            <Button size="sm" className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
              <Plus className="h-4 w-4" /> New space
            </Button>
          }
        >
          {spaces.length === 0 ? (
            <EmptyState
              icon={DoorOpen}
              title="No spaces yet"
              description="Add the ballroom, breakout rooms or terrace so they can be planned and booked."
              action={
                <Button className="bg-primary text-primary-foreground hover:bg-primary/90" onClick={() => setCreateOpen(true)}>
                  <Plus className="h-4 w-4" /> New space
                </Button>
              }
            />
          ) : (
            <ul className="divide-y divide-border">
              {spaces.map((space) => (
                <li key={space.id} className="flex items-center gap-3 py-3 first:pt-0 last:pb-0">
                  <button type="button" onClick={() => setOpenId(space.id)} className="min-w-0 flex-1 text-left">
                    <span className="block truncate text-sm font-medium text-foreground">{space.name || "Untitled space"}</span>
                    <span className="mt-0.5 block truncate text-xs text-text-secondary">
                      {[spaceMeta(space), space.bookable ? rateSummary(space) : ""].filter(Boolean).join(" · ") || "Add size, capacity and rates"}
                    </span>
                  </button>
                  <StatusPill status={space.bookable ? "Bookable" : "Off"} map={BOOKABLE_MAP} />
                  <ActionMenu
                    label={`Actions for ${space.name}`}
                    items={[
                      { label: "Edit space", onSelect: () => setOpenId(space.id) },
                      space.bookable
                        ? { label: "Turn off Instant Book", onSelect: () => handleBookable(space, false) }
                        : { label: "Turn on Instant Book", onSelect: () => handleBookable(space, true) },
                      { separator: true },
                      { label: "Delete", variant: "destructive", onSelect: () => setDeleteTarget(space) },
                    ]}
                  />
                </li>
              ))}
            </ul>
          )}
        </SectionCard>
      )}

      <NewSpaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={handleCreate} />

      <Dialog open={!!deleteTarget} onOpenChange={(o) => !o && setDeleteTarget(null)}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Delete space</DialogTitle>
            <DialogDescription>
              Delete <span className="font-medium text-foreground">{deleteTarget?.name || "this space"}</span>? It disappears
              from Instant Book and floor planning. Existing bookings stay on record.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setDeleteTarget(null)}>
              Cancel
            </Button>
            <Button className="bg-red-500/90 text-white hover:bg-red-500" onClick={() => handleDelete(deleteTarget)}>
              <Trash2 className="h-4 w-4" /> Delete space
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

export default VenueSpacesSection;
