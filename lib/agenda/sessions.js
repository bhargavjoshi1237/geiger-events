// Shared reasoning about an event's sessions — the time arithmetic, the
// day/track/room vocabulary, and the overlap rules.
//
// A session is an events.conference_records row with module "session"; its
// schedule lives in the `config` bag as free-text `day` plus "HH:mm" `startTime`
// / `endTime`. Two very different surfaces need the same answers about that
// shape — the Agenda Builder's grid and the Display Boards renderer — so the
// logic lives here rather than being written twice with two sets of edge cases.
//
// Pure functions only: no React, no data access.

// "HH:mm" -> minutes since midnight, or null when unset/malformed.
export function toMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

// Minutes since midnight -> "HH:mm", the storage format.
export function toTimeValue(mins) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(
    clamped % 60,
  ).padStart(2, "0")}`;
}

// Minutes since midnight -> "1:30 PM", the display format.
export function minutesToLabel(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const sessionStart = (s) => toMinutes(s?.config?.startTime);
export const sessionEnd = (s) => toMinutes(s?.config?.endTime);

// A session's length in minutes. Falls back to an hour when only a start is set,
// which is what both the grid and the boards assume for an open-ended slot.
export function sessionDuration(s, fallback = 60) {
  const start = sessionStart(s);
  const end = sessionEnd(s);
  if (start == null) return fallback;
  if (end == null || end <= start) return fallback;
  return end - start;
}

const field = (s, key) => (s?.config?.[key] || "").trim();

// Sessions for one day-string ("" = every day), sorted by start, unscheduled last.
export function sessionsForDay(sessions, day) {
  const list = (sessions || []).filter((s) => (day ? field(s, "day") === day : true));
  return [...list].sort((a, b) => (sessionStart(a) ?? 1e9) - (sessionStart(b) ?? 1e9));
}

// Distinct day-strings across the agenda, in natural order. `day` is free text
// ("Day 1 · Tue"), so numeric-aware collation is the best ordering available.
export function agendaDays(sessions) {
  return [...new Set((sessions || []).map((s) => field(s, "day")))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, undefined, { numeric: true }));
}

export function agendaTracks(sessions) {
  return [...new Set((sessions || []).map((s) => field(s, "track")))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

export function agendaRooms(sessions) {
  return [...new Set((sessions || []).map((s) => field(s, "room")))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
}

// Split a day's sessions around a wall-clock minute: what's on air, what's next.
export function splitNowNext(sessions, nowMins) {
  const live = [];
  const upcoming = [];
  for (const s of sessions) {
    const start = sessionStart(s);
    if (start == null) continue;
    const end = sessionEnd(s) ?? start + 60;
    if (start <= nowMins && nowMins < end) live.push(s);
    else if (start > nowMins) upcoming.push(s);
  }
  return { live, upcoming };
}

// Do two sessions occupy the same day and overlap in time?
function overlaps(a, b) {
  if (field(a, "day") !== field(b, "day")) return false;
  const aStart = sessionStart(a);
  const bStart = sessionStart(b);
  if (aStart == null || bStart == null) return false;
  const aEnd = aStart + sessionDuration(a);
  const bEnd = bStart + sessionDuration(b);
  return aStart < bEnd && bStart < aEnd;
}

// Double-bookings across the agenda: the same speaker, or the same room, in two
// places at once. Returns one entry per clashing pair —
// { kind: "speaker" | "room", value, a, b } — plus a Set of the session ids
// involved, so a grid can flag a block without re-deriving the pairs.
export function findConflicts(sessions) {
  const list = sessions || [];
  const pairs = [];

  for (const key of ["speaker", "room"]) {
    // Bucket by the shared value first, so this stays linear in practice rather
    // than comparing every session against every other one.
    const buckets = new Map();
    for (const s of list) {
      const value = field(s, key).toLowerCase();
      if (!value) continue;
      if (!buckets.has(value)) buckets.set(value, []);
      buckets.get(value).push(s);
    }
    for (const [, bucket] of buckets) {
      for (let i = 0; i < bucket.length; i += 1) {
        for (let j = i + 1; j < bucket.length; j += 1) {
          if (overlaps(bucket[i], bucket[j])) {
            pairs.push({
              kind: key,
              value: field(bucket[i], key),
              a: bucket[i],
              b: bucket[j],
            });
          }
        }
      }
    }
  }

  const ids = new Set();
  for (const pair of pairs) {
    ids.add(pair.a.id);
    ids.add(pair.b.id);
  }
  return { pairs, ids };
}
