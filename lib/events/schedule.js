
const DEFAULT_TZ = "Europe/London";

function parseDate(iso) {
  const [y, m, d] = String(iso || "").split("-").map(Number);
  return y && m && d ? { y, m, d } : null;
}

function zoneOf(event) {
  return event?.timezone || DEFAULT_TZ;
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

export function eventWeekday(event, { long = false } = {}) {
  const parts = parseDate(event?.date);
  if (!parts) return "";
  return new Date(Date.UTC(parts.y, parts.m - 1, parts.d)).toLocaleDateString(
    "en-US",
    { weekday: long ? "long" : "short", timeZone: "UTC" },
  );
}

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
    }
  }
  return "";
}

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

function dayDelta(fromKey, toKey) {
  const a = parseDate(fromKey);
  const b = parseDate(toKey);
  if (!a || !b) return 0;
  return Math.round(
    (Date.UTC(b.y, b.m - 1, b.d) - Date.UTC(a.y, a.m - 1, a.d)) / 86400000,
  );
}

export function eventCountdown(event, now = new Date()) {
  const start = eventStartDate(event);
  if (!start) return null;
  const tz = zoneOf(event);
  const days = dayDelta(zonedDateKey(now, tz), event.date);
  const ms = start.getTime() - now.getTime();

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
