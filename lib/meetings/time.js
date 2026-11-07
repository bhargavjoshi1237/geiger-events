// Wall-clock <-> instant conversion in an event's IANA timezone, plus display formatters. Pure.

export const DEFAULT_TZ = "Europe/London";

export const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
export const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

export function safeZone(tz) {
  if (!tz) return DEFAULT_TZ;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return tz;
  } catch {
    return DEFAULT_TZ;
  }
}

// "HH:MM" -> minutes after midnight (null when malformed).
export function hmToMinutes(value) {
  const s = String(value ?? "").trim();
  if (!TIME_RE.test(s)) return null;
  const [h, m] = s.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToHm(mins) {
  const m = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  return `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
}

function zoneOffsetMs(instant, timeZone) {
  try {
    const parts = {};
    for (const p of new Intl.DateTimeFormat("en-US", {
      timeZone,
      hour12: false,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    }).formatToParts(instant)) {
      parts[p.type] = p.value;
    }
    const wall = Date.UTC(
      Number(parts.year),
      Number(parts.month) - 1,
      Number(parts.day),
      Number(parts.hour) % 24,
      Number(parts.minute),
      Number(parts.second),
    );
    return wall - instant.getTime();
  } catch {
    return 0;
  }
}

// Local wall time (date + minutes) in `tz` -> Date instant. Two passes settle DST edges.
export function wallToDate(dateStr, minutes, tz) {
  if (!DATE_RE.test(String(dateStr || ""))) return null;
  const [y, m, d] = dateStr.split("-").map(Number);
  const wall = Date.UTC(y, m - 1, d, 0, 0, 0) + Math.round(minutes) * 60000;
  const zone = safeZone(tz);
  let ts = wall - zoneOffsetMs(new Date(wall), zone);
  ts = wall - zoneOffsetMs(new Date(ts), zone);
  return new Date(ts);
}

// Instant -> { date: "YYYY-MM-DD", minutes } as seen on a wall clock in `tz`.
export function dateToWall(value, tz) {
  const instant = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(instant.getTime())) return null;
  const shifted = new Date(instant.getTime() + zoneOffsetMs(instant, safeZone(tz)));
  return {
    date: shifted.toISOString().slice(0, 10),
    minutes: shifted.getUTCHours() * 60 + shifted.getUTCMinutes(),
  };
}

export function toIso(value) {
  const d = value instanceof Date ? value : new Date(value);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

export function fmtTime(value, tz) {
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", timeZone: safeZone(tz) });
}

// "YYYY-MM-DD" -> "Fri, Nov 20" (calendar date, no zone shift).
export function fmtDayLabel(dateStr, { long = false } = {}) {
  if (!DATE_RE.test(String(dateStr || ""))) return "";
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-US", {
    weekday: long ? "long" : "short",
    month: long ? "long" : "short",
    day: "numeric",
    timeZone: "UTC",
  });
}

export function fmtDayOf(value, tz, opts) {
  const wall = dateToWall(value, tz);
  return wall ? fmtDayLabel(wall.date, opts) : "";
}

export function fmtRange(start, end, tz) {
  const a = fmtTime(start, tz);
  const b = fmtTime(end, tz);
  return a && b ? `${a} – ${b}` : a;
}

// "Fri, Nov 20 · 9:00 AM – 9:20 AM"
export function fmtSlot(start, end, tz) {
  const day = fmtDayOf(start, tz);
  return [day, fmtRange(start, end, tz)].filter(Boolean).join(" · ");
}

export function tzAbbrev(tz, at = new Date()) {
  const zone = safeZone(tz);
  for (const timeZoneName of ["short", "shortOffset"]) {
    try {
      const name = new Intl.DateTimeFormat("en-US", { timeZone: zone, timeZoneName })
        .formatToParts(at)
        .find((p) => p.type === "timeZoneName")?.value;
      if (name) return name;
    } catch {
      // Older engines lack shortOffset; fall through.
    }
  }
  return zone;
}
