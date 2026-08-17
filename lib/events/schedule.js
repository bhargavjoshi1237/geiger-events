// Event start-time presentation: the weekday, the timezone the wall-clock time
// is stated in, and how far out the event is. An event stores a naive local date
// + time (`event_date`, `event_time`) plus the IANA zone they're written in
// (`timezone`), so turning that into a real instant means resolving the zone's
// offset at that moment. Pure functions — no React, no DB.

const DEFAULT_TZ = "Europe/London";

function parseDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  // A date can be cleared in the editor — callers render nothing rather than NaN.
  return y && m && d ? { y, m, d } : null;
}

function zoneOf(event) {
  return event?.timezone || DEFAULT_TZ;
}

// How far `timeZone` is from UTC at the given instant, in ms. Formats the
// instant as wall-clock in that zone and diffs it back against the instant.
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
    // An unknown/invalid zone degrades to UTC rather than throwing.
    return 0;
  }
}

// The event's start as a real instant. Two offset passes so a start that sits
// on the far side of a DST boundary still resolves to the right moment.
export function eventStartDate(event) {
  const parts = parseDate(event?.date);
  if (!parts) return null;
  const [hh, mm] = String(event?.time || "").split(":").map(Number);
  const wall = Date.UTC(
    parts.y,
    parts.m - 1,
    parts.d,
    Number.isFinite(hh) ? hh : 0,
    Number.isFinite(mm) ? mm : 0,
  );
  const tz = zoneOf(event);
  let ts = wall - zoneOffsetMs(new Date(wall), tz);
  ts = wall - zoneOffsetMs(new Date(ts), tz);
  return new Date(ts);
}

// "Sat" / "Saturday" for the event's date. Read in UTC so the viewer's own
// timezone can't shift it a day either way.
export function eventWeekday(event, { long = false } = {}) {
  const parts = parseDate(event?.date);
  if (!parts) return "";
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).toLocaleDateString(
    "en-US",
    { weekday: long ? "long" : "short", timeZone: "UTC" },
  );
}

// Short label for the zone the event's time is stated in — "GMT+1", falling
// back to an abbreviation ("BST") where shortOffset isn't supported.
export function eventTimezoneLabel(event) {
  const tz = event?.timezone;
  if (!tz) return "";
  const at = eventStartDate(event) || new Date();
  for (const timeZoneName of ["shortOffset", "short"]) {
    try {
      const parts = new Intl.DateTimeFormat("en-US", {
        timeZone: tz,
        timeZoneName,
      }).formatToParts(at);
      const name = parts.find((p) => p.type === "timeZoneName")?.value;
      if (name) return name;
    } catch {
      // Try the next style.
    }
  }
  return "";
}

// The event's date as a "YYYY-MM-DD" key in its own timezone, so "today" is
// the organizer's today rather than the viewer's.
function zonedDateKey(instant, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(instant);
  } catch {
    return instant.toISOString().slice(0, 10);
  }
}

// Whole calendar days between two "YYYY-MM-DD" keys, DST-proof (both are read
// as UTC midnights, so no offset can round the difference off by one).
function dayDelta(fromKey, toKey) {
  const a = parseDate(fromKey);
  const b = parseDate(toKey);
  if (!a || !b) return 0;
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000,
  );
}

// How soon the event is, as `{ label, tone }` — null when it has no date yet.
// Tones let the caller style urgency: "soon" (today/tomorrow) and "live"
// (already started) get emphasis, "upcoming" and "past" stay quiet.
export function eventCountdown(event, now = new Date()) {
  const start = eventStartDate(event);
  if (!start) return null;
  const tz = zoneOf(event);
  const days = dayDelta(zonedDateKey(now, tz), event.date);
  const ms = start.getTime() - now.getTime();

  // No end time is stored, so an event that has begun stays "Started" for the
  // rest of its day and is only called past once that day is over.
  if (ms <= 0) {
    return days >= 0
      ? { label: "Started", tone: "live" }
      : { label: "Past event", tone: "past" };
  }
  if (days <= 0) {
    const mins = Math.round(ms / 60000);
    return mins < 60
      ? { label: `In ${mins} min`, tone: "live" }
      : { label: "Today", tone: "live" };
  }
  if (days === 1) return { label: "Tomorrow", tone: "soon" };
  if (days < 60) return { label: `In ${days} days`, tone: "upcoming" };
  const months = Math.round(days / 30);
  if (months < 12)
    return { label: `In ${months} months`, tone: "upcoming" };
  const years = Math.round(days / 365);
  return {
    label: `In ${years} year${years === 1 ? "" : "s"}`,
    tone: "upcoming",
  };
}
