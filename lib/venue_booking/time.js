// Timezone helpers for venue booking — plain Intl, no dependencies.
// A "wall" value is the venue's local clock encoded as UTC ms (Date.UTC(y, m, d, h, mi)), so
// day/minute arithmetic on it never crosses a DST shift.

export const MINUTE_MS = 60_000;
export const HOUR_MS = 60 * MINUTE_MS;
export const DAY_MS = 24 * HOUR_MS;
export const DAY_MINUTES = 24 * 60;

// getUTCDay() order; the SQL side indexes the same array by extract(dow).
export const WEEKDAY_KEYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

const formatters = new Map();

function partsFormatter(timeZone) {
  let fmt = formatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-US", {
      timeZone,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    formatters.set(timeZone, fmt);
  }
  return fmt;
}

// A valid IANA zone or UTC — a bad venue timezone must never crash a screen.
export function safeTimeZone(timeZone) {
  if (!timeZone) return "UTC";
  try {
    partsFormatter(timeZone);
    return timeZone;
  } catch {
    return "UTC";
  }
}

const toDate = (value) => (value instanceof Date ? value : new Date(value));

// Instant -> the venue's wall clock as UTC-encoded ms.
export function toWall(instant, timeZone) {
  const date = toDate(instant);
  if (Number.isNaN(date.getTime())) return NaN;
  const out = {};
  for (const p of partsFormatter(safeTimeZone(timeZone)).formatToParts(date)) out[p.type] = p.value;
  return Date.UTC(
    Number(out.year),
    Number(out.month) - 1,
    Number(out.day),
    Number(out.hour) % 24,
    Number(out.minute),
    Number(out.second),
  );
}

// Wall clock -> instant. Two passes settle the zone offset, including across DST changes.
export function fromWall(wall, timeZone) {
  if (!Number.isFinite(wall)) return new Date(NaN);
  const tz = safeTimeZone(timeZone);
  const offset1 = toWall(wall, tz) - wall;
  let instant = wall - offset1;
  const offset2 = toWall(instant, tz) - instant;
  if (offset2 !== offset1) instant = wall - offset2;
  return new Date(instant);
}

const pad = (n) => String(n).padStart(2, "0");

export function wallDateString(wall) {
  const d = new Date(wall);
  return `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())}`;
}

export function wallDayStart(wall) {
  return Math.floor(wall / DAY_MS) * DAY_MS;
}

export function wallMinutes(wall) {
  return Math.floor((wall - wallDayStart(wall)) / MINUTE_MS);
}

export function wallWeekday(wall) {
  return WEEKDAY_KEYS[new Date(wall).getUTCDay()];
}

// "YYYY-MM-DD" -> wall ms at local midnight, or NaN.
export function parseDateString(value) {
  const m = String(value || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return NaN;
  const wall = Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  return wallDateString(wall) === value ? wall : NaN;
}

// "HH:MM" -> minutes since midnight; "24:00" -> 1440. Null when unparseable.
export function parseClock(value) {
  const m = String(value || "").trim().match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return null;
  const h = Number(m[1]);
  const mi = Number(m[2]);
  if (h > 24 || mi > 59 || (h === 24 && mi > 0)) return null;
  return h * 60 + mi;
}

export function clockString(minutes) {
  const m = Math.max(0, Math.min(DAY_MINUTES, Math.round(minutes)));
  return `${pad(Math.floor(m / 60))}:${pad(m % 60)}`;
}

// Venue-local date + time strings -> instant.
export function zonedInstant(dateString, timeString, timeZone) {
  const day = parseDateString(dateString);
  const mins = parseClock(timeString);
  if (!Number.isFinite(day) || mins == null) return null;
  const date = fromWall(day + mins * MINUTE_MS, timeZone);
  return Number.isNaN(date.getTime()) ? null : date;
}

// Instant -> { date: "YYYY-MM-DD", time: "HH:MM" } on the venue's clock.
export function zonedDateTime(instant, timeZone) {
  const wall = toWall(instant, timeZone);
  if (!Number.isFinite(wall)) return { date: "", time: "" };
  return { date: wallDateString(wall), time: clockString(wallMinutes(wall)) };
}

export function addDays(dateString, days) {
  const wall = parseDateString(dateString);
  if (!Number.isFinite(wall)) return dateString;
  return wallDateString(wall + days * DAY_MS);
}

// Today on the venue's clock.
export function todayIn(timeZone, now = new Date()) {
  return wallDateString(toWall(now, timeZone));
}

// The Monday on or before a date.
export function weekStart(dateString) {
  const wall = parseDateString(dateString);
  if (!Number.isFinite(wall)) return dateString;
  const dow = new Date(wall).getUTCDay();
  return wallDateString(wall - ((dow + 6) % 7) * DAY_MS);
}

export function formatInZone(instant, timeZone, options) {
  const date = toDate(instant);
  if (Number.isNaN(date.getTime())) return "—";
  try {
    return new Intl.DateTimeFormat("en-GB", { timeZone: safeTimeZone(timeZone), ...options }).format(date);
  } catch {
    return date.toISOString();
  }
}

// Short zone label such as "GMT", "BST" or "GMT+8" for an instant.
export function zoneAbbreviation(instant, timeZone) {
  const date = toDate(instant ?? new Date());
  try {
    const part = new Intl.DateTimeFormat("en-GB", { timeZone: safeTimeZone(timeZone), timeZoneName: "short" })
      .formatToParts(Number.isNaN(date.getTime()) ? new Date() : date)
      .find((p) => p.type === "timeZoneName");
    return part?.value || timeZone || "UTC";
  } catch {
    return timeZone || "UTC";
  }
}

// "Tue 12 Dec, 09:00 – 17:00" or "Tue 12 Dec 09:00 – Wed 13 Dec 17:00" on the venue's clock.
export function formatRange(startsAt, endsAt, timeZone) {
  const start = zonedDateTime(startsAt, timeZone);
  const endWall = toWall(endsAt, timeZone);
  const sameDay = start.date && start.date === wallDateString(endWall - 1);
  const day = (instant) => formatInZone(instant, timeZone, { weekday: "short", day: "numeric", month: "short" });
  const time = (instant) => formatInZone(instant, timeZone, { hour: "2-digit", minute: "2-digit", hourCycle: "h23" });
  const endTime = Number.isFinite(endWall) && wallMinutes(endWall) === 0 && sameDay ? "24:00" : time(endsAt);
  if (sameDay) return `${day(startsAt)}, ${time(startsAt)} – ${endTime}`;
  return `${day(startsAt)} ${time(startsAt)} – ${day(endsAt)} ${time(endsAt)}`;
}

export function hoursBetween(startsAt, endsAt) {
  const ms = toDate(endsAt).getTime() - toDate(startsAt).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms / HOUR_MS) : 0;
}
