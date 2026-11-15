import { MINUTE_MS, toWall, fromWall, wallDateString, wallDayStart, wallMinutes, parseDateString } from "../../venue_booking/time.js";

// Schedule maths for the schedule and timeline blocks: records → timed items, clashes and slot snapping. Pure.
export const SLOT = 15;
const DEFAULT_MINUTES = 30;

export const snap = (minutes, step = SLOT) => Math.round(minutes / step) * step;

const idsOf = (row, fieldId) => (row.links?.[fieldId] ?? []).map((link) => link.id).filter(Boolean);

// The lane values of a record: linked ids for link fields, the option id for a single choice.
function lanesOf(row, lane) {
  if (!lane) return [];
  if (lane.type === "single_select") return row.values?.[lane.id] ? [row.values[lane.id]] : [];
  return idsOf(row, lane.id);
}

// Records → items with start/end instants, the event-time-zone day and minutes, lanes and people.
export function scheduleItems(rows, { startField, endField = null, durationField = null, laneField = null, peopleField = null, timeZone = "UTC" }) {
  const items = [];
  for (const row of rows ?? []) {
    const start = Date.parse(row.values?.[startField] ?? "");
    if (!Number.isFinite(start)) continue;
    let end = endField ? Date.parse(row.values?.[endField] ?? "") : NaN;
    if (!Number.isFinite(end) && durationField && Number.isFinite(row.values?.[durationField])) end = start + row.values[durationField] * 1000;
    if (!Number.isFinite(end) || end <= start) end = start + DEFAULT_MINUTES * MINUTE_MS;
    const wall = toWall(start, timeZone);
    const endWall = toWall(end, timeZone);
    const day = wallDateString(wall);
    const startMin = wallMinutes(wall);
    // An item ending on a later day runs to the end of its own day on the grid.
    const endMin = wallDayStart(endWall) > wallDayStart(wall) ? 24 * 60 : Math.max(startMin + SLOT, wallMinutes(endWall));
    items.push({ id: row.id, row, start, end, day, startMin, endMin, lanes: lanesOf(row, laneField), people: peopleField ? idsOf(row, peopleField) : [] });
  }
  return items.sort((a, b) => a.start - b.start || a.end - b.end);
}

// Items that overlap in time and share a lane (or, with people, a person): id → Set of the other ids.
export function findClashes(items, { by = "lanes" } = {}) {
  const clashes = new Map();
  const add = (a, b) => {
    if (!clashes.has(a.id)) clashes.set(a.id, new Set());
    clashes.get(a.id).add(b.id);
  };
  const sorted = [...items].sort((a, b) => a.start - b.start);
  for (let i = 0; i < sorted.length; i += 1) {
    for (let j = i + 1; j < sorted.length && sorted[j].start < sorted[i].end; j += 1) {
      const shared = sorted[i][by].some((key) => sorted[j][by].includes(key));
      if (shared) { add(sorted[i], sorted[j]); add(sorted[j], sorted[i]); }
    }
  }
  return clashes;
}

// The days items fall on, or the days from a start date, in order.
export function scheduleDays(items, { startDate = null, count = 0 } = {}) {
  const days = new Set(items.map((item) => item.day));
  if (startDate && Number.isFinite(parseDateString(startDate))) {
    for (let i = 0; i < count; i += 1) days.add(wallDateString(parseDateString(startDate) + i * 86_400_000));
  }
  return [...days].sort();
}

// The visible hours for a day: the items' span widened to whole hours, at least the default working day.
export function dayWindow(items, { from = 8 * 60, to = 18 * 60 } = {}) {
  let start = from;
  let end = to;
  for (const item of items) {
    start = Math.min(start, Math.floor(item.startMin / 60) * 60);
    end = Math.max(end, Math.ceil(item.endMin / 60) * 60);
  }
  return { from: Math.max(0, start), to: Math.min(24 * 60, end) };
}

// New start/end instants (ISO) for an item moved to `startMin` on `day`, keeping its length; or resized to `endMin`.
export function movedTimes(item, { day = item.day, startMin = item.startMin, endMin = null, timeZone = "UTC" }) {
  const base = parseDateString(day);
  const length = item.end - item.start;
  const start = fromWall(base + snap(startMin) * MINUTE_MS, timeZone);
  const end = endMin === null ? new Date(start.getTime() + length) : fromWall(base + Math.max(snap(endMin), snap(startMin) + SLOT) * MINUTE_MS, timeZone);
  return { start: start.toISOString(), end: end.toISOString() };
}

// Timeline bars: each item's offset and width (0..1) inside [from, to).
export function timelineBars(items, from, to) {
  const span = to - from;
  return items.filter((item) => item.end > from && item.start < to).map((item) => ({
    ...item,
    left: Math.max(0, (item.start - from) / span),
    width: Math.max(0.004, (Math.min(item.end, to) - Math.max(item.start, from)) / span),
  }));
}
