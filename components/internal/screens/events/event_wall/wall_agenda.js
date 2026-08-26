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

export function isoOf(date) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function todayISO() {
  return isoOf(new Date());
}

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

export function monthGrid(year, monthIndex) {
  const first = new Date(year, monthIndex, 1);
  const start = new Date(year, monthIndex, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => {
    const d = new Date(start.getFullYear(), start.getMonth(), start.getDate() + i);
    return { iso: isoOf(d), day: d.getDate(), inMonth: d.getMonth() === monthIndex };
  });
}

export function formatTime(value) {
  const m = String(value || "").match(/^(\d{1,2}):(\d{2})/);
  if (!m) return String(value || "");
  const h = Number(m[1]);
  const suffix = h >= 12 ? "PM" : "AM";
  const hour = h % 12 === 0 ? 12 : h % 12;
  return `${hour}:${m[2]} ${suffix}`;
}

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

export function typeCounts(events) {
  const counts = new Map();
  for (const e of events) {
    const key = e.type || "Other";
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()].map(([type, count]) => ({ type, count }));
}

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

export function eventDays(events) {
  return new Set(events.map((e) => e.date).filter(Boolean));
}

export function locatedEvents(events) {
  return events
    .map((e) => {
      const c = e.map?.coords;
      if (!Number.isFinite(c?.lat) || !Number.isFinite(c?.lng)) return null;
      return { event: e, lat: c.lat, lng: c.lng };
    })
    .filter(Boolean);
}
