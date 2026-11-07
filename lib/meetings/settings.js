// Meeting Scheduler settings, statuses and validation shared by the dashboard, the portal API and the slot engine. Pure.

import { DATE_RE, TIME_RE, hmToMinutes } from "./time";

export const REQUEST_SCOPES = [
  { value: "opted_in", label: "Attendees who opted in", hint: "Only people who joined networking appear in the directory." },
  { value: "all", label: "Every ticket holder", hint: "All attendees are listed unless they opt out." },
  { value: "exhibitors", label: "Exhibitors only", hint: "Attendees can only request exhibitors; exhibitors see everyone who opted in." },
];

export const REQUEST_STATUSES = ["pending", "accepted", "declined", "cancelled", "expired"];
export const MEETING_STATUSES = ["scheduled", "completed", "no_show", "cancelled"];

export const MAX_PROPOSED_SLOTS = 3;
export const MAX_PENDING_OUTGOING = 25;
export const MAX_TAGS = 12;
export const MAX_TAG_LENGTH = 40;

const clampInt = (v, min, max, fallback) => {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n)) return fallback;
  return Math.max(min, Math.min(max, n));
};

const str = (v, max = 200) => String(v ?? "").trim().slice(0, max);

const isoOrNull = (v) => {
  if (!v) return null;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
};

export function newLocationId() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID().slice(0, 8);
  return Math.random().toString(36).slice(2, 10);
}

export function defaultMeetingSettings(event) {
  return {
    enabled: false,
    opensAt: null,
    closesAt: null,
    slotMinutes: 20,
    bufferMinutes: 5,
    days: event?.date ? [{ date: event.date, start: "09:00", end: "17:00", agendaDay: "" }] : [],
    excludeSessions: true,
    locations: [],
    maxMeetings: 10,
    requestScope: "opted_in",
    requireAcceptance: true,
    messageMaxLength: 500,
  };
}

export function normalizeDay(day) {
  const d = day && typeof day === "object" ? day : {};
  return {
    date: DATE_RE.test(String(d.date || "")) ? d.date : "",
    start: TIME_RE.test(String(d.start || "")) ? d.start : "09:00",
    end: TIME_RE.test(String(d.end || "")) ? d.end : "17:00",
    agendaDay: str(d.agendaDay, 80),
  };
}

export function normalizeLocation(loc) {
  const l = loc && typeof loc === "object" ? loc : {};
  return {
    id: str(l.id, 40) || newLocationId(),
    name: str(l.name, 80) || "Untitled location",
    capacity: clampInt(l.capacity, 1, 999, 1),
  };
}

// DB row (snake_case) -> settings view model.
export function normalizeSettingsRow(row, event) {
  const base = defaultMeetingSettings(event);
  if (!row) return { ...base, id: null, eventId: event?.id ?? null, projectId: event?.projectId ?? null, saved: false };
  return {
    id: row.id,
    eventId: row.event_id ?? null,
    projectId: row.project_id ?? null,
    saved: true,
    enabled: Boolean(row.enabled),
    opensAt: row.opens_at ?? null,
    closesAt: row.closes_at ?? null,
    slotMinutes: clampInt(row.slot_minutes, 5, 240, base.slotMinutes),
    bufferMinutes: clampInt(row.buffer_minutes, 0, 120, base.bufferMinutes),
    days: (Array.isArray(row.days) ? row.days : []).map(normalizeDay).filter((d) => d.date),
    excludeSessions: row.exclude_sessions !== false,
    locations: (Array.isArray(row.locations) ? row.locations : []).map(normalizeLocation),
    maxMeetings: row.max_meetings == null ? null : clampInt(row.max_meetings, 1, 999, null),
    requestScope: REQUEST_SCOPES.some((s) => s.value === row.request_scope) ? row.request_scope : "opted_in",
    requireAcceptance: row.require_acceptance !== false,
    messageMaxLength: clampInt(row.message_max_length, 0, 4000, base.messageMaxLength),
    updatedAt: row.updated_at ?? null,
  };
}

// Settings view model -> DB columns (sanitised).
export function settingsToRow(input) {
  const s = input && typeof input === "object" ? input : {};
  const ids = new Set();
  const locations = (Array.isArray(s.locations) ? s.locations : []).map(normalizeLocation).filter((l) => {
    if (ids.has(l.id)) return false;
    ids.add(l.id);
    return true;
  });
  const max = s.maxMeetings === null || s.maxMeetings === "" || s.maxMeetings === undefined ? null : clampInt(s.maxMeetings, 1, 999, null);
  return {
    enabled: Boolean(s.enabled),
    opens_at: isoOrNull(s.opensAt),
    closes_at: isoOrNull(s.closesAt),
    slot_minutes: clampInt(s.slotMinutes, 5, 240, 20),
    buffer_minutes: clampInt(s.bufferMinutes, 0, 120, 5),
    days: (Array.isArray(s.days) ? s.days : [])
      .map(normalizeDay)
      .filter((d) => d.date)
      .sort((a, b) => (a.date + a.start).localeCompare(b.date + b.start)),
    exclude_sessions: s.excludeSessions !== false,
    locations,
    max_meetings: max,
    request_scope: REQUEST_SCOPES.some((x) => x.value === s.requestScope) ? s.requestScope : "opted_in",
    require_acceptance: s.requireAcceptance !== false,
    message_max_length: clampInt(s.messageMaxLength, 0, 4000, 500),
  };
}

// First problem with a settings draft, or null when it can be saved.
export function validateSettings(s) {
  if (!s) return "Nothing to save.";
  const days = Array.isArray(s.days) ? s.days : [];
  const seen = new Set();
  for (const d of days) {
    if (!DATE_RE.test(String(d.date || ""))) return "Every meeting day needs a date.";
    const start = hmToMinutes(d.start);
    const end = hmToMinutes(d.end);
    if (start == null || end == null) return "Every meeting day needs a start and end time.";
    if (end - start < Number(s.slotMinutes || 0)) return `The window on ${d.date} is shorter than one meeting slot.`;
    const key = `${d.date}-${d.start}`;
    if (seen.has(key)) return `${d.date} has the same window twice.`;
    seen.add(key);
  }
  if (s.enabled && !days.length) return "Add at least one meeting day before turning networking on.";
  for (const l of Array.isArray(s.locations) ? s.locations : []) {
    if (!str(l.name)) return "Every location needs a name.";
    if (!(Number(l.capacity) >= 1)) return `${l.name} needs a capacity of at least 1.`;
  }
  if (s.opensAt && s.closesAt && new Date(s.opensAt) >= new Date(s.closesAt)) {
    return "Requests must open before they close.";
  }
  return null;
}

// Is the request/accept window open right now?
export function bookingWindowState(settings, now = new Date()) {
  if (!settings?.enabled) return "off";
  const t = now.getTime();
  if (settings.opensAt && t < new Date(settings.opensAt).getTime()) return "not_open";
  if (settings.closesAt && t > new Date(settings.closesAt).getTime()) return "closed";
  return "open";
}

export function cleanTags(list) {
  const out = [];
  const seen = new Set();
  for (const raw of Array.isArray(list) ? list : []) {
    const tag = str(raw, MAX_TAG_LENGTH);
    const key = tag.toLowerCase();
    if (!tag || seen.has(key)) continue;
    seen.add(key);
    out.push(tag);
    if (out.length >= MAX_TAGS) break;
  }
  return out;
}

// Who is visible/requestable for a viewer, given the event's request scope.
export function isListedProfile(profile, { scope, viewerIsExhibitor = false } = {}) {
  if (!profile || profile.hidden) return false;
  if (scope === "all") return profile.optedIn !== false || !profile.hasProfile;
  if (scope === "exhibitors" && !viewerIsExhibitor) return profile.optedIn && profile.role === "exhibitor";
  return Boolean(profile.optedIn);
}

// May this attendee send requests at all?
export function canNetwork(profile, scope) {
  if (profile?.hidden) return false;
  if (scope === "all") return !(profile?.hasProfile && profile.optedIn === false);
  return Boolean(profile?.optedIn);
}
