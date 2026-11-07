"use client";

import React, { useMemo, useState } from "react";
import { toast } from "sonner";
import { Loader2, MapPin, Plus, Trash2 } from "lucide-react";

import { Field, SectionCard, SettingRow, SettingsList } from "@/components/internal/shared/screen_kit";
import { Button } from "@geiger/ui/button";
import { Input } from "@geiger/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@geiger/ui/select";
import { EventDatePicker, EventTimeField } from "@/components/internal/screens/events/date_time_fields";
import { agendaDays } from "@/lib/agenda/sessions";
import { REQUEST_SCOPES, newLocationId, validateSettings } from "@/lib/meetings/settings";
import { daySlots } from "@/lib/meetings/slots";
import { dateToWall, hmToMinutes, minutesToHm, tzAbbrev, wallToDate } from "@/lib/meetings/time";

const AUTO = "__auto";

// datetime-local strings are read and written in the event's timezone, not the browser's.
const toLocalInput = (iso, tz) => {
  if (!iso) return "";
  const w = dateToWall(iso, tz);
  return w ? `${w.date}T${minutesToHm(w.minutes)}` : "";
};
const fromLocalInput = (value, tz) => {
  if (!value) return null;
  const [date, time] = value.split("T");
  const mins = hmToMinutes(time?.slice(0, 5));
  return mins == null ? null : wallToDate(date, mins, tz)?.toISOString() || null;
};

const nextDate = (date) => {
  if (!date) return "";
  const d = new Date(`${date}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
};

const numberOrBlank = (v) => (v === null || v === undefined ? "" : String(v));

export function SettingsTab({ event, settings, sessions, tz, onSave }) {
  const [draft, setDraft] = useState(settings);
  const [saving, setSaving] = useState(false);
  const [prev, setPrev] = useState(settings);
  if (settings !== prev) {
    setPrev(settings);
    setDraft(settings);
  }

  const set = (patch) => setDraft((d) => ({ ...d, ...patch }));
  const setDay = (i, patch) => set({ days: draft.days.map((d, j) => (j === i ? { ...d, ...patch } : d)) });
  const setLocation = (i, patch) =>
    set({ locations: draft.locations.map((l, j) => (j === i ? { ...l, ...patch } : l)) });

  const agendaOptions = useMemo(() => agendaDays(sessions), [sessions]);
  const totalCapacity = draft.locations.reduce((s, l) => s + (Number(l.capacity) || 0), 0);
  const dirty = draft !== settings;

  const save = async () => {
    const problem = validateSettings(draft);
    if (problem) {
      toast.error(problem);
      return;
    }
    setSaving(true);
    await onSave(draft);
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-xs text-text-tertiary">
          Times are in the event&apos;s timezone · {event.timezone} ({tzAbbrev(tz)})
        </p>
        <Button
          className="bg-primary text-primary-foreground hover:bg-primary/90"
          disabled={saving || !dirty}
          onClick={save}
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving…" : "Save settings"}
        </Button>
      </div>

      <SectionCard title="Networking" description="Whether attendees can book 1:1 meetings, and who they can ask.">
        <div className="space-y-5">
          <SettingsList>
            <SettingRow
              title="Open networking for this event"
              description="Ticket holders get a Networking section in the members portal."
              checked={draft.enabled}
              onCheckedChange={(v) => set({ enabled: v })}
            />
            <SettingRow
              title="Require acceptance"
              description="Off books the first suggested time straight away, without the other person confirming."
              checked={draft.requireAcceptance}
              onCheckedChange={(v) => set({ requireAcceptance: v })}
            />
          </SettingsList>
          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Who can be requested" hint={REQUEST_SCOPES.find((s) => s.value === draft.requestScope)?.hint}>
              <Select value={draft.requestScope} onValueChange={(v) => set({ requestScope: v })}>
                <SelectTrigger className="w-full bg-surface-card">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {REQUEST_SCOPES.map((s) => (
                    <SelectItem key={s.value} value={s.value}>
                      {s.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Meetings per attendee" hint="Leave empty for no limit.">
              <Input
                type="number"
                min={1}
                value={numberOrBlank(draft.maxMeetings)}
                onChange={(e) => set({ maxMeetings: e.target.value === "" ? null : e.target.value })}
                placeholder="No limit"
              />
            </Field>
            <Field label="Message length" hint="Characters allowed with a request. 0 turns messages off.">
              <Input
                type="number"
                min={0}
                max={4000}
                value={numberOrBlank(draft.messageMaxLength)}
                onChange={(e) => set({ messageMaxLength: e.target.value })}
              />
            </Field>
          </div>
        </div>
      </SectionCard>

      <SectionCard title="Request window" description="When attendees can send and accept requests. Leave empty to stay open until the last slot.">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Opens">
            <Input
              type="datetime-local"
              value={toLocalInput(draft.opensAt, tz)}
              onChange={(e) => set({ opensAt: fromLocalInput(e.target.value, tz) })}
            />
          </Field>
          <Field label="Closes">
            <Input
              type="datetime-local"
              value={toLocalInput(draft.closesAt, tz)}
              onChange={(e) => set({ closesAt: fromLocalInput(e.target.value, tz) })}
            />
          </Field>
        </div>
      </SectionCard>

      <SectionCard title="Slots" description="How long each meeting runs and the gap people get between them.">
        <div className="space-y-5">
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Meeting length (minutes)" stepper value={draft.slotMinutes} onValueChange={(v) => set({ slotMinutes: Number(v) })} step={5} min={5} max={240}>
              <Input type="number" value={numberOrBlank(draft.slotMinutes)} onChange={(e) => set({ slotMinutes: e.target.value })} />
            </Field>
            <Field label="Buffer between meetings (minutes)" stepper value={draft.bufferMinutes} onValueChange={(v) => set({ bufferMinutes: Number(v) })} step={5} min={0} max={120}>
              <Input type="number" value={numberOrBlank(draft.bufferMinutes)} onChange={(e) => set({ bufferMinutes: e.target.value })} />
            </Field>
          </div>
          <SettingsList>
            <SettingRow
              title="Keep agenda sessions free"
              description={
                sessions.length
                  ? `No meetings while any of this event's ${sessions.length} agenda sessions are running. Link each day to its agenda day below.`
                  : "No meetings during agenda sessions. This event has no sessions in the Agenda Builder yet."
              }
              checked={draft.excludeSessions}
              onCheckedChange={(v) => set({ excludeSessions: v })}
            />
          </SettingsList>
        </div>
      </SectionCard>

      <SectionCard
        title="Meeting days"
        description="The hours on each day when meetings can happen."
        action={
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() => {
              const last = draft.days[draft.days.length - 1];
              set({
                days: [
                  ...draft.days,
                  { date: last ? nextDate(last.date) : event.date || "", start: last?.start || "09:00", end: last?.end || "17:00", agendaDay: "" },
                ],
              });
            }}
          >
            <Plus className="h-4 w-4" /> Add day
          </Button>
        }
      >
        {draft.days.length ? (
          <div className="space-y-3">
            {draft.days.map((d, i) => {
              const count = daySlots(
                { slotMinutes: Number(draft.slotMinutes), bufferMinutes: Number(draft.bufferMinutes) },
                d,
                tz,
              ).length;
              return (
                <div key={i} className="grid items-end gap-3 rounded-lg border border-border bg-surface-card p-3 sm:grid-cols-[1.4fr_1fr_1fr_1.4fr_auto]">
                  <Field label="Date">
                    <EventDatePicker value={d.date} onChange={(v) => setDay(i, { date: v })} />
                  </Field>
                  <Field label="From">
                    <EventTimeField value={d.start} onChange={(v) => setDay(i, { start: v })} />
                  </Field>
                  <Field label="Until">
                    <EventTimeField value={d.end} onChange={(v) => setDay(i, { end: v })} />
                  </Field>
                  <Field label="Agenda day" hint={`${count} slot${count === 1 ? "" : "s"}`}>
                    <Select value={d.agendaDay || AUTO} onValueChange={(v) => setDay(i, { agendaDay: v === AUTO ? "" : v })}>
                      <SelectTrigger className="w-full bg-surface-subtle">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value={AUTO}>Match automatically</SelectItem>
                        {agendaOptions.map((label) => (
                          <SelectItem key={label} value={label}>
                            {label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label="Remove day"
                    className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                    onClick={() => set({ days: draft.days.filter((_, j) => j !== i) })}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="text-sm text-text-tertiary">No meeting days yet. Add the days attendees can meet.</p>
        )}
      </SectionCard>

      <SectionCard
        title="Locations"
        description={
          draft.locations.length
            ? `Tables, booths or rooms meetings are assigned to · up to ${totalCapacity} meetings at once.`
            : "Tables, booths or rooms meetings are assigned to. Without any, meetings have no set place."
        }
        action={
          <Button
            variant="outline"
            size="sm"
            className="border-border bg-transparent text-muted-foreground hover:bg-surface-active hover:text-foreground"
            onClick={() =>
              set({
                locations: [
                  ...draft.locations,
                  { id: newLocationId(), name: `Table ${draft.locations.length + 1}`, capacity: 1 },
                ],
              })
            }
          >
            <Plus className="h-4 w-4" /> Add location
          </Button>
        }
      >
        {draft.locations.length ? (
          <div className="space-y-2">
            {draft.locations.map((l, i) => (
              <div key={l.id} className="grid items-end gap-3 rounded-lg border border-border bg-surface-card p-3 sm:grid-cols-[1fr_160px_auto]">
                <Field label="Name">
                  <Input value={l.name} onChange={(e) => setLocation(i, { name: e.target.value })} placeholder="e.g. Table 4" />
                </Field>
                <Field label="Meetings at once">
                  <Input type="number" min={1} value={numberOrBlank(l.capacity)} onChange={(e) => setLocation(i, { capacity: e.target.value })} />
                </Field>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={`Remove ${l.name}`}
                  className="text-muted-foreground hover:bg-surface-active hover:text-foreground"
                  onClick={() => set({ locations: draft.locations.filter((_, j) => j !== i) })}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            ))}
          </div>
        ) : (
          <p className="flex items-center gap-2 text-sm text-text-tertiary">
            <MapPin className="h-4 w-4" /> No locations yet.
          </p>
        )}
      </SectionCard>
    </div>
  );
}

export default SettingsTab;
