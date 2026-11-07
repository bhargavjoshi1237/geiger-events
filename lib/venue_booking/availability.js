// Venue space availability — opening hours, blackouts, turnover buffers and existing bookings.
// evaluateSlot() mirrors events.venue_booking_evaluate() in SQL, which re-checks every booking under a row lock.

import {
  DAY_MINUTES,
  DAY_MS,
  MINUTE_MS,
  WEEKDAY_KEYS,
  addDays,
  clockString,
  fromWall,
  parseClock,
  parseDateString,
  toWall,
  wallDateString,
  wallDayStart,
} from "./time.js";
import { priceSegments, ratesOf } from "./pricing.js";

// Editor order, Monday first.
export const OPENING_DAYS = [
  { key: "mon", label: "Monday", plural: "Mondays" },
  { key: "tue", label: "Tuesday", plural: "Tuesdays" },
  { key: "wed", label: "Wednesday", plural: "Wednesdays" },
  { key: "thu", label: "Thursday", plural: "Thursdays" },
  { key: "fri", label: "Friday", plural: "Fridays" },
  { key: "sat", label: "Saturday", plural: "Saturdays" },
  { key: "sun", label: "Sunday", plural: "Sundays" },
];

const PLURAL = Object.fromEntries(OPENING_DAYS.map((d) => [d.key, d.plural]));

const ALL_DAY = { open: 0, close: DAY_MINUTES };

// An empty object (or a missing day) means open around the clock; null / {closed:true} means closed.
export function dayWindow(openingHours, weekday) {
  const hours = openingHours && typeof openingHours === "object" ? openingHours : {};
  if (!Object.keys(hours).length || !(weekday in hours)) return ALL_DAY;
  const day = hours[weekday];
  if (!day || typeof day !== "object" || day.closed === true) return null;
  const open = parseClock(day.open) ?? 0;
  const close = parseClock(day.close) ?? DAY_MINUTES;
  return close > open ? { open, close } : null;
}

export function hasOpeningHours(openingHours) {
  return Boolean(openingHours && typeof openingHours === "object" && Object.keys(openingHours).length);
}

// The blackout covering a "YYYY-MM-DD" date, if any.
export function blackoutOn(blackouts, date) {
  if (!Array.isArray(blackouts)) return null;
  return (
    blackouts.find((b) => {
      if (!Number.isFinite(parseDateString(b?.from))) return false;
      const to = Number.isFinite(parseDateString(b?.to)) ? b.to : b.from;
      return date >= b.from && date <= to;
    }) || null
  );
}

const fail = (code, message) => ({ ok: false, code, message, segments: [] });

// Validates a slot against the space's rules and splits it into venue-local day segments.
export function evaluateSlot(space, startsAt, endsAt, timeZone) {
  const start = new Date(startsAt);
  const end = new Date(endsAt);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return fail("INVALID_RANGE", "Pick a start and end time.");
  }
  if (end <= start) return fail("INVALID_RANGE", "The end time must be after the start time.");
  const minHours = Math.max(0, Number(space?.minHours) || 0);
  if ((end - start) / 3_600_000 < minHours) {
    return fail("BELOW_MINIMUM", `This space has a ${minHours}-hour minimum.`);
  }

  const startWall = toWall(start, timeZone);
  const endWall = toWall(end, timeZone);
  const firstDay = wallDayStart(startWall);
  const lastDay = wallDayStart(endWall - 1);
  const segments = [];

  for (let day = firstDay; day <= lastDay; day += DAY_MS) {
    const date = wallDateString(day);
    const weekday = WEEKDAY_KEYS[new Date(day).getUTCDay()];
    const blackout = blackoutOn(space?.blackoutDates, date);
    if (blackout) {
      return fail("BLACKOUT", `Unavailable on ${date}${blackout.reason ? ` (${blackout.reason})` : ""}.`);
    }
    const window = dayWindow(space?.openingHours, weekday);
    if (!window) return fail("CLOSED", `Closed on ${PLURAL[weekday]}.`);

    const segStart = day === firstDay ? Math.floor((startWall - day) / MINUTE_MS) : 0;
    const segEnd = day === lastDay ? Math.ceil((endWall - day) / MINUTE_MS) : DAY_MINUTES;
    if (day === firstDay) {
      if (segStart < window.open) return fail("BEFORE_OPENING", `Opens at ${clockString(window.open)} on ${PLURAL[weekday]}.`);
      if (segStart >= window.close) return fail("AFTER_CLOSING", `Closes at ${clockString(window.close)} on ${PLURAL[weekday]}.`);
    }
    if (day === lastDay) {
      if (segEnd > window.close) return fail("AFTER_CLOSING", `Closes at ${clockString(window.close)} on ${PLURAL[weekday]}.`);
      if (segEnd <= window.open) return fail("BEFORE_OPENING", `Opens at ${clockString(window.open)} on ${PLURAL[weekday]}.`);
    }
    const billableMinutes = Math.max(0, Math.min(segEnd, window.close) - Math.max(segStart, window.open));
    segments.push({ date, weekday, startMinute: segStart, endMinute: segEnd, billableMinutes });
  }
  return { ok: true, code: null, message: "", segments };
}

// --- Bookings ------------------------------------------------------------------

export function isLiveHold(booking, now = Date.now()) {
  return booking?.status === "hold" && booking.holdExpiresAt != null && new Date(booking.holdExpiresAt).getTime() > now;
}

export function isExpiredHold(booking, now = Date.now()) {
  return booking?.status === "hold" && !isLiveHold(booking, now);
}

// Confirmed bookings and unexpired holds block the space; expired holds simply stop blocking.
export function isBlocking(booking, now = Date.now()) {
  if (!booking || booking.deletedAt) return false;
  return booking.status === "confirmed" || isLiveHold(booking, now);
}

// "Confirmed" | "Hold" | "Hold expired" | "Cancelled" | "Completed".
export function bookingDisplayStatus(booking, now = Date.now()) {
  if (!booking) return "";
  if (booking.status === "cancelled") return "Cancelled";
  if (booking.status === "hold") return isLiveHold(booking, now) ? "Hold" : "Hold expired";
  return new Date(booking.endsAt).getTime() <= now ? "Completed" : "Confirmed";
}

// Each booking blocks [start, end + its turnover buffer); two bookings clash when those ranges overlap.
export function blockedUntil(booking) {
  if (booking?.blockedUntil) return new Date(booking.blockedUntil).getTime();
  return new Date(booking?.endsAt).getTime();
}

export function findClash(bookings, spaceId, startsAt, endsAt, bufferMinutes = 0, { excludeId, now = Date.now() } = {}) {
  const start = new Date(startsAt).getTime();
  const until = new Date(endsAt).getTime() + Math.max(0, Number(bufferMinutes) || 0) * MINUTE_MS;
  return (
    (bookings || []).find(
      (b) =>
        b.spaceId === spaceId &&
        b.id !== excludeId &&
        isBlocking(b, now) &&
        new Date(b.startsAt).getTime() < until &&
        start < blockedUntil(b),
    ) || null
  );
}

// Full check for a proposed booking: rules, capacity, clashes and price.
export function checkSlot({ space, timeZone, startsAt, endsAt, bookings, setupStyle, attendees, excludeId, now = Date.now() }) {
  const rules = evaluateSlot(space, startsAt, endsAt, timeZone);
  const rates = ratesOf(space);
  const priced = rules.ok ? priceSegments(rules.segments, rates) : null;
  if (!rules.ok) return { ok: false, code: rules.code, message: rules.message, quote: null, clash: null };
  if (new Date(startsAt).getTime() < now) {
    return { ok: false, code: "IN_PAST", message: "That time has already passed.", quote: priced, clash: null };
  }
  const cap = setupStyle ? Number(space?.capacities?.[setupStyle]) || 0 : 0;
  if (cap > 0 && Number(attendees) > cap) {
    return { ok: false, code: "OVER_CAPACITY", message: `Holds ${cap} in this setup.`, quote: priced, clash: null };
  }
  const clash = findClash(bookings, space?.id, startsAt, endsAt, space?.bufferMinutes, { excludeId, now });
  if (clash) {
    return { ok: false, code: "SLOT_TAKEN", message: "Already booked at that time.", quote: priced, clash };
  }
  return { ok: true, code: null, message: "", quote: priced, clash: null };
}

// quote(rates, start, end) for callers without a space row: opening hours default to all day.
export function quote(rates, startsAt, endsAt, { timeZone = "UTC", openingHours = {}, blackoutDates = [], minHours = 0 } = {}) {
  const rules = evaluateSlot({ openingHours, blackoutDates, minHours }, startsAt, endsAt, timeZone);
  if (!rules.ok) return { ok: false, code: rules.code, message: rules.message };
  return { ok: true, ...priceSegments(rules.segments, rates) };
}

// --- Free time -----------------------------------------------------------------

function mergeIntervals(list) {
  const sorted = list.filter(([a, b]) => b > a).sort((x, y) => x[0] - y[0]);
  const out = [];
  for (const [a, b] of sorted) {
    const last = out[out.length - 1];
    if (last && a <= last[1]) last[1] = Math.max(last[1], b);
    else out.push([a, b]);
  }
  return out;
}

// Busy minute ranges on one venue-local day: each blocking booking plus its turnover buffer.
export function busyMinutes(bookings, spaceId, date, timeZone, { now = Date.now() } = {}) {
  const day = parseDateString(date);
  if (!Number.isFinite(day)) return [];
  const ranges = [];
  for (const b of bookings || []) {
    if (b.spaceId !== spaceId || !isBlocking(b, now)) continue;
    const s = (toWall(b.startsAt, timeZone) - day) / MINUTE_MS;
    const e = (toWall(new Date(blockedUntil(b)), timeZone) - day) / MINUTE_MS;
    if (e <= 0 || s >= DAY_MINUTES) continue;
    ranges.push([Math.max(0, s), Math.min(DAY_MINUTES, e)]);
  }
  return mergeIntervals(ranges);
}

// Free slots on one day within opening hours, as instants, never shorter than the space's minimum.
export function freeSlots(space, bookings, date, timeZone, { now = Date.now() } = {}) {
  const day = parseDateString(date);
  if (!Number.isFinite(day) || blackoutOn(space?.blackoutDates, date)) return [];
  const window = dayWindow(space?.openingHours, WEEKDAY_KEYS[new Date(day).getUTCDay()]);
  if (!window) return [];
  const buffer = Math.max(0, Number(space?.bufferMinutes) || 0);
  // A new booking must also leave its own turnover before the next booking starts.
  const busy = busyMinutes(bookings, space?.id, date, timeZone, { now }).map(([a, b]) => [a - buffer, b]);
  const nowMin = (toWall(now, timeZone) - day) / MINUTE_MS;
  let cursor = Math.max(window.open, Math.ceil(nowMin / 15) * 15);
  const minMinutes = Math.max(15, (Number(space?.minHours) || 0) * 60);
  const slots = [];
  for (const [a, b] of mergeIntervals(busy)) {
    const slotEnd = Math.min(a, window.close);
    if (slotEnd - cursor >= minMinutes) slots.push([cursor, slotEnd]);
    cursor = Math.max(cursor, b);
  }
  if (window.close - cursor >= minMinutes) slots.push([cursor, window.close]);
  return slots.map(([a, b]) => ({
    startMinute: a,
    endMinute: b,
    startsAt: fromWall(day + a * MINUTE_MS, timeZone),
    endsAt: fromWall(day + b * MINUTE_MS, timeZone),
  }));
}

// Free slots for each day of the week starting at `weekStartDate`.
export function weekAvailability(space, bookings, weekStartDate, timeZone, { now = Date.now() } = {}) {
  return Array.from({ length: 7 }, (_, i) => {
    const date = addDays(weekStartDate, i);
    return { date, slots: freeSlots(space, bookings, date, timeZone, { now }) };
  });
}
