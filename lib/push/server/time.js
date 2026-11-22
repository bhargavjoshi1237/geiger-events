import { dateToWall, fmtDayLabel, fmtTime, hmToMinutes, safeZone, wallToDate } from "../../meetings/time.js";

// Event start instants, quiet-hour windows and push-friendly date copy. Pure.

const LOOSE_TIME = /^(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i;

// "19:00", "7pm", "7:30 PM - 10pm" -> minutes after midnight, else null.
export function parseEventTime(value) {
  const s = String(value ?? "").trim();
  const strict = hmToMinutes(s.slice(0, 5));
  if (strict !== null && !/^\d{1,2}:\d{2}\s*(am|pm)/i.test(s)) return strict;
  const m = LOOSE_TIME.exec(s);
  if (!m) return null;
  let h = Number(m[1]);
  const min = Number(m[2] || 0);
  const ampm = (m[3] || "").toLowerCase();
  if (min > 59 || h > 23 || (ampm && (h < 1 || h > 12))) return null;
  if (ampm === "pm" && h !== 12) h += 12;
  if (ampm === "am" && h === 12) h = 0;
  return h * 60 + min;
}

// { start: Date|null, hasTime } for an events row; date-only events start at 09:00 local for day-ahead reminders.
export function eventStart(event) {
  if (!event?.event_date) return { start: null, hasTime: false };
  const minutes = parseEventTime(event.event_time);
  const start = wallToDate(event.event_date, minutes ?? 9 * 60, safeZone(event.timezone));
  return { start, hasTime: minutes !== null };
}

// "Sat, Nov 8 · 7:00 PM" in the event's zone; date only when the time is unknown.
export function fmtWhen(start, tz, { hasTime = true } = {}) {
  if (!start) return "";
  const wall = dateToWall(start, tz);
  const day = wall ? fmtDayLabel(wall.date) : "";
  return hasTime ? [day, fmtTime(start, tz)].filter(Boolean).join(" · ") : day;
}

export function fmtEventWhen(event) {
  const { start, hasTime } = eventStart(event);
  return fmtWhen(start, safeZone(event?.timezone), { hasTime });
}

// "1 hour", "30 minutes", "3 hours", "2 days".
export function fmtLead(minutes) {
  const m = Math.round(Number(minutes) || 0);
  if (m % 1440 === 0) return m === 1440 ? "1 day" : `${m / 1440} days`;
  if (m % 60 === 0) return m === 60 ? "1 hour" : `${m / 60} hours`;
  return m === 1 ? "1 minute" : `${m} minutes`;
}

// Whether `now` falls inside the quiet window (HH:MM–HH:MM, may wrap midnight) as seen in `tz`.
export function inQuietHours(now, quietHours, tz) {
  if (!quietHours?.enabled) return false;
  const start = hmToMinutes(quietHours.start);
  const end = hmToMinutes(quietHours.end);
  if (start === null || end === null || start === end) return false;
  const wall = dateToWall(now, safeZone(tz));
  if (!wall) return false;
  const t = wall.minutes;
  return start < end ? t >= start && t < end : t >= start || t < end;
}

// The next instant the quiet window ends after `now` (only meaningful while inQuietHours is true).
export function quietHoursEnd(now, quietHours, tz) {
  const zone = safeZone(tz);
  const end = hmToMinutes(quietHours?.end);
  const wall = dateToWall(now, zone);
  if (end === null || !wall) return new Date(now.getTime() + 60 * 60000);
  let candidate = wallToDate(wall.date, end, zone);
  if (!candidate || candidate.getTime() <= now.getTime()) {
    const next = new Date(Date.UTC(...wall.date.split("-").map((n, i) => Number(n) - (i === 1 ? 1 : 0))) + 86400000);
    candidate = wallToDate(next.toISOString().slice(0, 10), end, zone);
  }
  return candidate;
}
