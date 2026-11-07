// Meeting slot engine: generate slots from the settings windows, subtract agenda sessions, people's meetings and
// blocked slots, find mutual availability and allocate locations. Pure; instants are ISO strings.

import { sessionDuration, sessionStart } from "@/lib/agenda/sessions";
import { DATE_RE, hmToMinutes, toIso, wallToDate } from "./time";

const MIN = 60000;
const BOOKED = new Set(["scheduled", "completed", "no_show"]);

const ms = (v) => {
  const t = typeof v === "number" ? v : Date.parse(v);
  return Number.isFinite(t) ? t : null;
};

export const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

export function sortedDays(settings) {
  return [...(settings?.days || [])]
    .filter((d) => DATE_RE.test(String(d?.date || "")))
    .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start));
}

export function meetingDates(settings) {
  return [...new Set(sortedDays(settings).map((d) => d.date))];
}

// Slots for one day window: back-to-back meetings spaced by the buffer.
export function daySlots(settings, day, tz) {
  const len = Number(settings?.slotMinutes) || 0;
  const step = len + (Number(settings?.bufferMinutes) || 0);
  const from = hmToMinutes(day?.start);
  const to = hmToMinutes(day?.end);
  if (!len || from == null || to == null || !DATE_RE.test(String(day?.date || ""))) return [];
  const out = [];
  for (let t = from; t + len <= to; t += step) {
    const start = wallToDate(day.date, t, tz);
    const end = wallToDate(day.date, t + len, tz);
    if (!start || !end) continue;
    out.push({
      key: start.toISOString(),
      date: day.date,
      startMin: t,
      endMin: t + len,
      start: start.toISOString(),
      end: end.toISOString(),
    });
  }
  return out;
}

export function allSlots(settings, tz) {
  const seen = new Set();
  const out = [];
  for (const day of sortedDays(settings)) {
    for (const slot of daySlots(settings, day, tz)) {
      if (seen.has(slot.key)) continue;
      seen.add(slot.key);
      out.push(slot);
    }
  }
  return out.sort((a, b) => a.start.localeCompare(b.start));
}

export function slotsForDate(settings, tz, date) {
  return allSlots(settings, tz).filter((s) => s.date === date);
}

export function groupSlotsByDate(slots) {
  const map = new Map();
  for (const s of slots || []) {
    if (!map.has(s.date)) map.set(s.date, []);
    map.get(s.date).push(s);
  }
  return [...map.entries()].map(([date, list]) => ({ date, slots: list }));
}

// Does a generated slot start and end exactly here?
export function findSlot(settings, tz, start, end) {
  const a = toIso(start);
  const b = toIso(end);
  if (!a || !b) return null;
  return allSlots(settings, tz).find((s) => s.start === a && s.end === b) || null;
}

// Which meeting day an agenda session falls on, when it carries only a free-text day label.
function sessionOnDay(session, day, settings) {
  const label = String(session?.config?.day || "").trim().toLowerCase();
  const link = String(day?.agendaDay || "").trim().toLowerCase();
  if (link) return label === link;
  if (DATE_RE.test(label)) return label === day.date;
  const dates = meetingDates(settings);
  if (dates.length === 1) return true;
  const numbered = /\bday\s*(\d+)/i.exec(label);
  if (numbered) return dates.indexOf(day.date) === Number(numbered[1]) - 1;
  return !label;
}

// Agenda sessions as busy intervals [{ start, end, name }] (epoch ms) on the meeting days.
export function sessionIntervals(sessions, settings, tz) {
  if (!settings?.excludeSessions) return [];
  const out = [];
  const seenDates = new Set();
  for (const s of sessions || []) {
    if (!s || s.status === "Cancelled") continue;
    const at = ms(s.startsAt);
    if (at != null) {
      const end = ms(s.endsAt);
      out.push({ start: at, end: end != null && end > at ? end : at + sessionDuration(s) * MIN, name: s.name || "" });
      continue;
    }
    const startMin = sessionStart(s);
    if (startMin == null) continue;
    const dur = sessionDuration(s);
    seenDates.clear();
    for (const day of sortedDays(settings)) {
      if (seenDates.has(day.date) || !sessionOnDay(s, day, settings)) continue;
      seenDates.add(day.date);
      const start = wallToDate(day.date, startMin, tz);
      if (start) out.push({ start: start.getTime(), end: start.getTime() + dur * MIN, name: s.name || "" });
    }
  }
  return out;
}

const toInterval = (x) => {
  const start = ms(x?.start ?? x?.startsAt);
  const end = ms(x?.end ?? x?.endsAt);
  return start != null && end != null && end > start ? { start, end } : null;
};

// A person's booked meetings as intervals (cancelled ones free the time again).
export function busyFor(meetings, memberId, { excludeId } = {}) {
  return (meetings || [])
    .filter(
      (m) =>
        m.id !== excludeId &&
        BOOKED.has(m.status || "scheduled") &&
        (m.participants || []).includes(memberId),
    )
    .map(toInterval)
    .filter(Boolean);
}

export function blockedIntervals(blocked) {
  return (blocked || []).map(toInterval).filter(Boolean);
}

// Meetings running at a location during [start, end).
export function locationLoad(meetings, locationId, start, end, { excludeId } = {}) {
  const a = ms(start);
  const b = ms(end);
  return (meetings || []).filter(
    (m) =>
      m.id !== excludeId &&
      (m.status || "scheduled") === "scheduled" &&
      m.locationId === locationId &&
      overlaps(ms(m.startsAt), ms(m.endsAt), a, b),
  ).length;
}

// First location with spare capacity (mirrors events.meeting_pick_location); null = none configured, false = all full.
export function pickLocation(locations, meetings, start, end, opts) {
  if (!locations?.length) return null;
  for (const l of locations) {
    if (locationLoad(meetings, l.id, start, end, opts) < (Number(l.capacity) || 1)) return l.id;
  }
  return false;
}

// Slots with no clash against the agenda, the given busy/blocked intervals, the past, or full locations.
export function freeSlots({
  settings,
  tz,
  sessions = [],
  busy = [],
  blocked = [],
  eventMeetings = null,
  now = Date.now(),
}) {
  const buffer = (Number(settings?.bufferMinutes) || 0) * MIN;
  const agenda = sessionIntervals(sessions, settings, tz);
  const nowMs = ms(now) ?? Date.now();
  return allSlots(settings, tz).filter((slot) => {
    const s = ms(slot.start);
    const e = ms(slot.end);
    if (s <= nowMs) return false;
    if (agenda.some((i) => overlaps(s, e, i.start, i.end))) return false;
    if (blocked.some((i) => overlaps(s, e, i.start, i.end))) return false;
    if (busy.some((i) => overlaps(s, e + buffer, i.start, i.end + buffer))) return false;
    if (eventMeetings && pickLocation(settings.locations, eventMeetings, slot.start, slot.end) === false) {
      return false;
    }
    return true;
  });
}

// Slots where every given person is free. people: [{ busy, blocked }].
export function mutualSlots({ settings, tz, sessions = [], people = [], eventMeetings = null, now }) {
  return freeSlots({
    settings,
    tz,
    sessions,
    busy: people.flatMap((p) => p.busy || []),
    blocked: people.flatMap((p) => p.blocked || []),
    eventMeetings,
    now,
  });
}

// Share of location capacity booked across every slot (null when no locations are set).
export function locationUtilisation(settings, tz, meetings) {
  const locations = settings?.locations || [];
  if (!locations.length) return null;
  const slots = allSlots(settings, tz).length;
  const capacity = locations.reduce((sum, l) => sum + (Number(l.capacity) || 1), 0) * slots;
  if (!capacity) return null;
  const ids = new Set(locations.map((l) => l.id));
  const booked = (meetings || []).filter((m) => BOOKED.has(m.status) && ids.has(m.locationId)).length;
  return Math.min(1, booked / capacity);
}
