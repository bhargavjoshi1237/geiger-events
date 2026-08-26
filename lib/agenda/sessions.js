
export function toMinutes(value) {
  const match = /^(\d{1,2}):(\d{2})$/.exec(String(value ?? "").trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h > 23 || m > 59) return null;
  return h * 60 + m;
}

export function toTimeValue(mins) {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, Math.round(mins)));
  return `${String(Math.floor(clamped / 60)).padStart(2, "0")}:${String(
    clamped % 60,
  ).padStart(2, "0")}`;
}

export function minutesToLabel(mins) {
  const h = Math.floor(mins / 60) % 24;
  const m = mins % 60;
  const hour12 = h % 12 === 0 ? 12 : h % 12;
  return `${hour12}:${String(m).padStart(2, "0")} ${h < 12 ? "AM" : "PM"}`;
}

export const sessionStart = (s) => toMinutes(s?.config?.startTime);
export const sessionEnd = (s) => toMinutes(s?.config?.endTime);

export function sessionDuration(s, fallback = 60) {
  const start = sessionStart(s);
  const end = sessionEnd(s);
  if (start == null) return fallback;
  if (end == null || end <= start) return fallback;
  return end - start;
}

const field = (s, key) => (s?.config?.[key] || "").trim();

export function sessionsForDay(sessions, day) {
  const list = (sessions || []).filter((s) => (day ? field(s, "day") === day : true));
  return [...list].sort((a, b) => (sessionStart(a) ?? 1e9) - (sessionStart(b) ?? 1e9));
}

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

function overlaps(a, b) {
  if (field(a, "day") !== field(b, "day")) return false;
  const aStart = sessionStart(a);
  const bStart = sessionStart(b);
  if (aStart == null || bStart == null) return false;
  const aEnd = aStart + sessionDuration(a);
  const bEnd = bStart + sessionDuration(b);
  return aStart < bEnd && bStart < aEnd;
}

export function findConflicts(sessions) {
  const list = sessions || [];
  const pairs = [];

  for (const key of ["speaker", "room"]) {
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
