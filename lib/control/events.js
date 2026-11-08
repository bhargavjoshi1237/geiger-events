// Control's event list: the event's own calendar decides "today", so it flips at the venue's midnight, not the server's.

const PAST_LIMIT = 10;

export function localDay(now, timeZone) {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone: timeZone || "UTC",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(now);
  } catch {
    return now.toISOString().slice(0, 10);
  }
}

export function toControlEvent(row, now) {
  const today = localDay(now, row.timezone);
  const when = !row.event_date
    ? "unscheduled"
    : row.event_date === today
      ? "today"
      : row.event_date > today
        ? "upcoming"
        : "past";
  return {
    id: row.id,
    name: row.name,
    status: row.status,
    date: row.event_date,
    time: row.event_time,
    venue: row.venue,
    city: row.city,
    timezone: row.timezone,
    capacity: row.capacity,
    sold: row.sold,
    coverUrl: row.cover_url,
    when,
  };
}

export function arrangeEvents(rows, now) {
  const events = rows.map((row) => toControlEvent(row, now));
  const pick = (when) => events.filter((e) => e.when === when);
  const soonest = (a, b) => String(a.date).localeCompare(String(b.date));
  return [
    ...pick("today"),
    ...pick("upcoming").sort(soonest),
    ...pick("unscheduled"),
    ...pick("past").sort((a, b) => soonest(b, a)).slice(0, PAST_LIMIT),
  ];
}
