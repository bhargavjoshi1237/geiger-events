// Pure date, grouping, and filtering helpers for the public Event Wall's
// agenda. No React and no data access — the list, the calendar, and the map all
// read from these, so a day in the grid and a day in the list can never
// disagree about which events fall on it.

const MONTHS_SHORT = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];
const WEEKDAYS_LONG = [
  "Sunday", "Monday", "Tuesday", "Wednesday",
  "Thursday", "Friday", "Saturday",
];
export const WEEKDAY_INITIALS = ["S", "M", "T", "W", "T", "F", "S"];

const pad = (n) => String(n).padStart(2, "0");

// Local calendar date, not UTC — "today" on the wall has to mean the viewer's
// today, or an evening event reads as yesterday's west of Greenwich.
export function isoOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return isoOf(new Date());
}

// "2026-08-28" -> { month: "Aug", day: 28, weekday: "Friday", year: 2026 }.
// Returns null for a cleared or malformed date so callers can skip the row.
export function parseISO(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  if (!y || !m || !d) return null;
  return {
    year: y,
    monthIndex: m - 1,
    month: MONTHS_SHORT[m - 1],
    day: d,
    weekday: WEEKDAYS_LONG[new Date(y, m - 1, d).getDay()],
  };
}

export function monthLabel(year, monthIndex) {
  return `${MONTHS_LONG[monthIndex]}${year === new Date().getFullYear() ? "" : ` ${year}`}`;
}

// Six weeks of cells starting on the Sunday of the week the month opens in —
// a fixed 42 so the sidebar never changes height between months.
export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === monthIndex };
  });
}

// "18:00" / "18:00:00" -> "6:00 PM". Passes anything unparseable straight
// through, since the field is free text in older rows.
export function formatTime(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(value || "");
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m[2]} ${suffix}`;
}

// The viewer's UTC offset as "GMT+5:30" / "GMT-8" / "GMT".
export function gmtOffsetLabel(date = new Date()) {
  const total = -date.getTimezoneOffset();
  if (!total) return "GMT";
  const sign = total < 0 ? "-" : "+";
  const abs = Math.abs(total);
  const hours = Math.floor(abs / 60);
  const minutes = abs % 60;
  return `GMT${sign}${hours}${minutes ? `:${pad(minutes)}` : ""}`;
}

export function formatClock(date = new Date()) {
  return `${formatTime(`${pad(date.getHours())}:${pad(date.getMinutes())}`)}`;
}

// Events matching the viewer's status choice, chronological. Featured events
// keep their place in the timeline (they're marked, not reordered) — an agenda
// that jumps out of date order stops being readable as an agenda.
export function byStatus(events, status) {
  const today = todayISO();
  const list = (Array.isArray(events) ? events : []).filter((e) => e.date);
  const scoped =
    status === "past"
      ? list.filter((e) => e.date < today)
      : list.filter((e) => e.date >= today);
  const dir = status === "past" ? -1 : 1;
  return [...scoped].sort(
    (a, b) => dir * (a.date.localeCompare(b.date) || String(a.time).localeCompare(String(b.time))),
  );
}

// Count per event type within the current status scope, for the filter chips.
export function typeCounts(events) {
  const counts = new Map();
  for (const e of events) {
    const key = e.type || "Other";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

// Viewer-side narrowing: a type chip, a picked calendar day, and free text over
// name / venue / city / organizer.
export function applyFilters(events, { type, day, query }) {
  const q = String(query || "").trim().toLowerCase();
  return events.filter((e) => {
    if (type && (e.type || "Other") !== type) return false;
    if (day && e.date !== day) return false;
    if (!q) return true;
    return [e.name, e.venue, e.city, e.organizer, e.summary]
      .filter(Boolean)
      .some((field) => String(field).toLowerCase().includes(q));
  });
}

// [{ date, parsed, events }] in the order the events arrive, so the grouping
// inherits whichever direction byStatus sorted them.
export function groupByDate(events) {
  const groups = [];
  let current = null;
  for (const e of events) {
    if (!current || current.date !== e.date) {
      current = { date: e.date, parsed: parseISO(e.date), events: [] };
      groups.push(current);
    }
    current.events.push(e);
  }
  return groups;
}

// Set of ISO days carrying at least one event — the calendar's dot markers.
export function eventDays(events) {
  return new Set(events.map((e) => e.date).filter(Boolean));
}

// Plottable events: those whose saved location picker run left coordinates
// behind (`metadata.map.coords`). Free-text-only venues have none and are
// skipped rather than geocoded here — N events would mean N Nominatim calls.
export function locatedEvents(events) {
  return events
    .map((e) => {
      const c = e.map?.coords;
      if (!Number.isFinite(c?.lat) || !Number.isFinite(c?.lng)) return null;
      return { event: e, lat: c.lat, lng: c.lng };
    })
    .filter(Boolean);
}
