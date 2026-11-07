"use client";

import React, { useMemo, useState } from "react";
import {
  CalendarCheck,
  CalendarClock,
  Check,
  Clock,
  Loader2,
  MapPin,
  RotateCcw,
  UserX,
  Users,
  XCircle,
} from "lucide-react";

import { Avatar, AvatarFallback, AvatarImage } from "@geiger/ui/avatar";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Textarea } from "@geiger/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@geiger/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { Field, StatusPill } from "@/components/internal/shared/screen_kit";
import { cn } from "@/lib/utils";
import { blockedIntervals, busyFor, freeSlots, groupSlotsByDate, overlaps } from "@/lib/meetings/slots";
import { fmtDayLabel, fmtSlot, fmtTime, toIso, tzAbbrev } from "@/lib/meetings/time";
import { MEETING_STATUS_MAP, initials, isFuture, personName } from "./constants";

export function PersonAvatar({ name, url, className }) {
  return (
    <Avatar className={cn("h-8 w-8 shrink-0", className)}>
      {url ? <AvatarImage src={url} alt="" /> : null}
      <AvatarFallback className="bg-surface-strong text-[11px] font-semibold text-foreground">
        {initials(name)}
      </AvatarFallback>
    </Avatar>
  );
}

// Searchable single-select over the event's attendees.
export function AttendeePicker({ label, options, value, onChange, exclude, warning }) {
  const [query, setQuery] = useState("");
  const selected = options.find((o) => o.memberId === value) || null;
  const matches = useMemo(() => {
    const q = query.trim().toLowerCase();
    return options
      .filter((o) => o.memberId !== exclude)
      .filter((o) => !q || `${o.name} ${o.email} ${o.company}`.toLowerCase().includes(q))
      .slice(0, 40);
  }, [options, query, exclude]);

  return (
    <Field label={label} hint={warning || undefined}>
      {selected ? (
        <div
          className={cn(
            "flex items-center gap-3 rounded-lg border bg-surface-card px-3 py-2",
            warning ? "border-amber-500/40" : "border-border",
          )}
        >
          <PersonAvatar name={selected.name} url={selected.profile?.avatarUrl} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-foreground">{selected.name}</p>
            <p className="truncate text-xs text-text-secondary">
              {[selected.company, selected.email].filter(Boolean).join(" · ")}
            </p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => onChange(null)}
          >
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          <Input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search by name, email or company…"
          />
          <div className="max-h-44 overflow-y-auto rounded-lg border border-border bg-surface-card">
            {matches.length ? (
              matches.map((o) => (
                <button
                  key={o.memberId}
                  type="button"
                  onClick={() => onChange(o.memberId)}
                  className="flex w-full items-center gap-3 border-b border-border px-3 py-2 text-left last:border-b-0 hover:bg-surface-hover"
                >
                  <PersonAvatar name={o.name} url={o.profile?.avatarUrl} className="h-7 w-7" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm text-foreground">{o.name}</span>
                    <span className="block truncate text-xs text-text-tertiary">
                      {[o.company, o.email].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                </button>
              ))
            ) : (
              <p className="px-3 py-3 text-xs text-text-tertiary">No attendees match.</p>
            )}
          </div>
        </div>
      )}
    </Field>
  );
}

// Free slots grouped by day as selectable chips. `highlight` marks the request's suggested times.
export function SlotPicker({ slots, tz, value, onChange, highlight, emptyText = "No free times left." }) {
  const groups = useMemo(() => groupSlotsByDate(slots), [slots]);
  if (!groups.length) {
    return (
      <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-xs text-text-tertiary">
        {emptyText}
      </p>
    );
  }
  return (
    <div className="max-h-72 space-y-3 overflow-y-auto pr-1">
      {groups.map((g) => (
        <div key={g.date} className="space-y-1.5">
          <p className="text-xs font-medium text-text-secondary">{fmtDayLabel(g.date, { long: true })}</p>
          <div className="flex flex-wrap gap-1.5">
            {g.slots.map((s) => {
              const on = value === s.key;
              const suggested = highlight?.has(s.start);
              return (
                <button
                  key={s.key}
                  type="button"
                  onClick={() => onChange(on ? null : s.key)}
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-xs tabular-nums transition-colors",
                    on
                      ? "border-primary bg-primary/15 text-foreground"
                      : "border-border bg-surface-card text-text-secondary hover:text-foreground",
                  )}
                >
                  {suggested ? <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> : null}
                  {fmtTime(s.start, tz)}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function LocationSelect({ locations, value, onChange }) {
  if (!locations?.length) return null;
  return (
    <Field label="Location" hint="Auto picks the first table or room with space at that time.">
      <Select value={value} onValueChange={onChange}>
        <SelectTrigger className="w-full bg-surface-card">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="auto">Assign automatically</SelectItem>
          {locations.map((l) => (
            <SelectItem key={l.id} value={l.id}>
              {l.name} · {l.capacity} at once
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </Field>
  );
}

// Is this person already booked around the slot (respecting the buffer)?
function clashes(meetings, memberId, slot, bufferMinutes, excludeId) {
  if (!memberId || !slot) return false;
  const buffer = (Number(bufferMinutes) || 0) * 60000;
  const s = Date.parse(slot.start);
  const e = Date.parse(slot.end);
  return busyFor(meetings, memberId, { excludeId }).some((i) => overlaps(s, e + buffer, i.start, i.end + buffer));
}

function blockedFor(people, memberId, slot) {
  if (!memberId || !slot) return false;
  const s = Date.parse(slot.start);
  const e = Date.parse(slot.end);
  return blockedIntervals(people.get(memberId)?.profile?.blockedSlots).some((i) => overlaps(s, e, i.start, i.end));
}

// Organiser books a meeting on behalf of two attendees at a clicked slot.
export function CreateMeetingDialog({ open, onOpenChange, slot, locationId, settings, tz, options, people, meetings, onCreate }) {
  const [a, setA] = useState(null);
  const [b, setB] = useState(null);
  const [notes, setNotes] = useState("");
  const [loc, setLoc] = useState("auto");
  const [saving, setSaving] = useState(false);
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setA(null);
      setB(null);
      setNotes("");
      setLoc(locationId || "auto");
    }
  }

  const warn = (id) =>
    clashes(meetings, id, slot, settings.bufferMinutes)
      ? `${personName(people, id)} already has a meeting around this time.`
      : blockedFor(people, id, slot)
        ? `${personName(people, id)} marked this time as unavailable.`
        : "";

  const submit = async () => {
    if (!a || !b) return;
    setSaving(true);
    const ok = await onCreate({
      participants: [a, b],
      startsAt: slot.start,
      endsAt: slot.end,
      locationId: loc === "auto" ? null : loc,
      notes: notes.trim(),
    });
    setSaving(false);
    if (ok) onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <CalendarClock className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">Book a meeting</DialogTitle>
            <DialogDescription className="text-xs">
              {slot ? `${fmtSlot(slot.start, slot.end, tz)} (${tzAbbrev(tz, new Date(slot.start))})` : ""}
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          <AttendeePicker label="First attendee" options={options} value={a} onChange={setA} exclude={b} warning={warn(a)} />
          <AttendeePicker label="Second attendee" options={options} value={b} onChange={setB} exclude={a} warning={warn(b)} />
          <LocationSelect locations={settings.locations} value={loc} onChange={setLoc} />
          <Field label="Notes" hint="Only your team sees these.">
            <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="e.g. Intro arranged with the sponsor team" />
          </Field>
        </div>
        <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!a || !b || saving}
            onClick={submit}
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Book meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Row({ icon: Icon, label, children }) {
  return (
    <div className="flex items-start justify-between gap-3 text-sm">
      <span className="flex shrink-0 items-center gap-1.5 text-text-secondary">
        {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
        {label}
      </span>
      <span className="min-w-0 text-right text-foreground">{children}</span>
    </div>
  );
}

// Meeting details with status changes, cancellation, notes and rescheduling.
export function MeetingDialog({ meeting, onOpenChange, people, settings, tz, sessions, meetings, onUpdate, onReschedule }) {
  const [mode, setMode] = useState("view");
  const [notes, setNotes] = useState("");
  const [reason, setReason] = useState("");
  const [slotKey, setSlotKey] = useState(null);
  const [loc, setLoc] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [prevId, setPrevId] = useState(null);
  if ((meeting?.id || null) !== prevId) {
    setPrevId(meeting?.id || null);
    setMode("view");
    setNotes(meeting?.notes || "");
    setReason("");
    setSlotKey(null);
    setLoc("auto");
  }

  const free = useMemo(() => {
    if (!meeting || mode !== "reschedule") return [];
    const ids = meeting.participants || [];
    return freeSlots({
      settings,
      tz,
      sessions,
      busy: ids.flatMap((id) => busyFor(meetings, id, { excludeId: meeting.id })),
      blocked: ids.flatMap((id) => blockedIntervals(people.get(id)?.profile?.blockedSlots)),
      eventMeetings: meetings.filter((m) => m.id !== meeting.id),
    });
  }, [meeting, mode, settings, tz, sessions, meetings, people]);

  if (!meeting) return null;
  const run = async (fn) => {
    setBusy(true);
    const ok = await fn();
    setBusy(false);
    return ok;
  };
  const future = isFuture(meeting.endsAt);
  const chosen = free.find((s) => s.key === slotKey) || null;

  return (
    <Dialog open={Boolean(meeting)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <Users className="h-5 w-5" />
          </div>
          <div className="min-w-0 flex-1 space-y-0.5">
            <DialogTitle className="truncate text-base">
              {(meeting.participants || []).map((id) => personName(people, id)).join(" & ")}
            </DialogTitle>
            <DialogDescription className="text-xs">
              {meeting.requestId ? "Booked from an attendee request" : "Booked by your team"}
            </DialogDescription>
          </div>
          <StatusPill status={meeting.status} map={MEETING_STATUS_MAP} />
        </DialogHeader>

        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {mode === "reschedule" ? (
            <>
              <p className="text-sm text-text-secondary">
                Times shown are free for both attendees{settings.excludeSessions ? " and clear of agenda sessions" : ""}.
              </p>
              <SlotPicker slots={free} tz={tz} value={slotKey} onChange={setSlotKey} emptyText="No other time is free for both attendees." />
              <LocationSelect locations={settings.locations} value={loc} onChange={setLoc} />
            </>
          ) : mode === "cancel" ? (
            <Field label="Reason" hint="Included in the email to both attendees.">
              <Textarea rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="e.g. The speaker had to leave early" autoFocus />
            </Field>
          ) : (
            <>
              <div className="space-y-2 rounded-xl border border-border bg-surface-card p-4">
                <Row icon={Clock} label="When">
                  {fmtSlot(meeting.startsAt, meeting.endsAt, tz)}
                </Row>
                <Row icon={MapPin} label="Where">
                  {meeting.locationName || "Unassigned"}
                </Row>
                {meeting.cancelReason ? <Row label="Reason">{meeting.cancelReason}</Row> : null}
              </div>
              <div className="space-y-2">
                {(meeting.participants || []).map((id) => {
                  const p = people.get(id);
                  return (
                    <div key={id} className="flex items-center gap-3 rounded-lg border border-border bg-surface-card px-3 py-2">
                      <PersonAvatar name={p?.name} url={p?.profile?.avatarUrl} />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium text-foreground">{personName(people, id)}</p>
                        <p className="truncate text-xs text-text-secondary">
                          {[p?.title, p?.company, p?.email].filter(Boolean).join(" · ") || "No longer holds a ticket"}
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <Field label="Notes" hint="Only your team sees these.">
                <Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Add a note…" />
              </Field>
            </>
          )}
        </div>

        <DialogFooter className="flex-wrap gap-2 border-t border-border bg-surface-subtle/40 px-5 py-4 sm:justify-between">
          {mode === "reschedule" ? (
            <>
              <Button variant="ghost" onClick={() => setMode("view")}>
                Back
              </Button>
              <Button
                className="bg-primary text-primary-foreground hover:bg-primary/90"
                disabled={!chosen || busy}
                onClick={() =>
                  run(() =>
                    onReschedule(meeting, {
                      startsAt: chosen.start,
                      endsAt: chosen.end,
                      locationId: loc === "auto" ? null : loc,
                    }),
                  ).then((ok) => ok && setMode("view"))
                }
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarClock className="h-4 w-4" />}
                Move meeting
              </Button>
            </>
          ) : mode === "cancel" ? (
            <>
              <Button variant="ghost" onClick={() => setMode("view")}>
                Back
              </Button>
              <Button
                className="bg-red-500/90 text-white hover:bg-red-500"
                disabled={busy}
                onClick={() =>
                  run(() => onUpdate(meeting, { status: "cancelled", cancelReason: reason.trim() })).then(
                    (ok) => ok && onOpenChange(false),
                  )
                }
              >
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <XCircle className="h-4 w-4" />}
                Cancel meeting
              </Button>
            </>
          ) : (
            <>
              <div className="flex flex-wrap gap-2">
                {meeting.status === "scheduled" && future ? (
                  <Button
                    variant="outline"
                    size="sm"
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => setMode("reschedule")}
                  >
                    <CalendarClock className="h-4 w-4" /> Reschedule
                  </Button>
                ) : null}
                {meeting.status === "scheduled" ? (
                  <>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      onClick={() => run(() => onUpdate(meeting, { status: "completed" }))}
                    >
                      <Check className="h-4 w-4" /> Completed
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={busy}
                      className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                      onClick={() => run(() => onUpdate(meeting, { status: "no_show" }))}
                    >
                      <UserX className="h-4 w-4" /> No-show
                    </Button>
                  </>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={busy || (meeting.status === "cancelled" && !future)}
                    className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => run(() => onUpdate(meeting, { status: "scheduled" }))}
                  >
                    <RotateCcw className="h-4 w-4" /> {meeting.status === "cancelled" ? "Restore" : "Mark scheduled"}
                  </Button>
                )}
              </div>
              <div className="flex flex-wrap gap-2">
                {notes !== (meeting.notes || "") ? (
                  <Button
                    size="sm"
                    disabled={busy}
                    className="bg-primary text-primary-foreground hover:bg-primary/90"
                    onClick={() => run(() => onUpdate(meeting, { notes }))}
                  >
                    Save notes
                  </Button>
                ) : null}
                {meeting.status === "scheduled" && future ? (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-red-600 hover:bg-red-500/10 hover:text-red-600 dark:text-red-400"
                    onClick={() => setMode("cancel")}
                  >
                    <XCircle className="h-4 w-4" /> Cancel
                  </Button>
                ) : null}
              </div>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// Organiser books an open request at a time that's free for both attendees.
export function ForceScheduleDialog({ request, onOpenChange, people, settings, tz, sessions, meetings, onConfirm }) {
  const [slotKey, setSlotKey] = useState(null);
  const [loc, setLoc] = useState("auto");
  const [busy, setBusy] = useState(false);
  const [prevId, setPrevId] = useState(null);

  const free = useMemo(() => {
    if (!request) return [];
    const ids = [request.fromMember, request.toMember];
    return freeSlots({
      settings,
      tz,
      sessions,
      busy: ids.flatMap((id) => busyFor(meetings, id)),
      blocked: ids.flatMap((id) => blockedIntervals(people.get(id)?.profile?.blockedSlots)),
      eventMeetings: meetings,
    });
  }, [request, settings, tz, sessions, meetings, people]);
  const suggested = useMemo(
    () => new Set((request?.proposedSlots || []).map((s) => toIso(s.start)).filter(Boolean)),
    [request],
  );

  if ((request?.id || null) !== prevId) {
    setPrevId(request?.id || null);
    setLoc("auto");
    setSlotKey(free.find((s) => suggested.has(s.start))?.key || null);
  }
  if (!request) return null;
  const chosen = free.find((s) => s.key === slotKey) || null;

  return (
    <Dialog open={Boolean(request)} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-lg gap-0 overflow-hidden bg-background p-0">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 border-b border-border p-5 text-left">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-subtle text-foreground">
            <CalendarCheck className="h-5 w-5" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <DialogTitle className="text-base">Schedule this request</DialogTitle>
            <DialogDescription className="text-xs">
              {personName(people, request.fromMember)} → {personName(people, request.toMember)} · both get a confirmation email
            </DialogDescription>
          </div>
        </DialogHeader>
        <div className="max-h-[60vh] space-y-4 overflow-y-auto p-5">
          {suggested.size ? (
            <p className="flex items-center gap-1.5 text-xs text-text-secondary">
              <span className="h-1.5 w-1.5 rounded-full bg-amber-400" /> Times the sender suggested
            </p>
          ) : null}
          <SlotPicker slots={free} tz={tz} value={slotKey} onChange={setSlotKey} highlight={suggested} emptyText="No time is free for both attendees." />
          <LocationSelect locations={settings.locations} value={loc} onChange={setLoc} />
        </div>
        <DialogFooter className="border-t border-border bg-surface-subtle/40 px-5 py-4">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            className="bg-primary text-primary-foreground hover:bg-primary/90"
            disabled={!chosen || busy}
            onClick={async () => {
              setBusy(true);
              const ok = await onConfirm(request, chosen, loc === "auto" ? null : loc);
              setBusy(false);
              if (ok) onOpenChange(false);
            }}
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <CalendarCheck className="h-4 w-4" />}
            Schedule meeting
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
