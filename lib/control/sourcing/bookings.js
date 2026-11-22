import { ApiError } from "../../staff_access/errors.js";
import { bookingDisplayStatus, isLiveHold } from "../../venue_booking/availability.js";
import { googleCalendarUrl } from "../../venue_booking/ics.js";
import { describeItem, formatMoney } from "../../venue_booking/pricing.js";
import { SETUP_STYLES, setupStyleLabel } from "../../venue_booking/styles.js";
import { DAY_MS, HOUR_MS, formatRange, safeTimeZone, zoneAbbreviation, zonedInstant } from "../../venue_booking/time.js";

// Instant Book for Control: the dashboard's booking list, stats and request checks, as pure functions.

const invalid = (message) => new ApiError("invalid_input", 400, message);
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const DATE = /^\d{4}-\d{2}-\d{2}$/;
const CLOCK = /^([01]\d|2[0-3]):[0-5]\d$/;

export const BOOKING_FILTERS = ["upcoming", "all", "Hold", "Confirmed", "Hold expired", "Completed", "Cancelled"];
export const HOLD_HOURS = [24, 48, 72, 168];
export const STYLE_KEYS = SETUP_STYLES.map((s) => s.key);

const num = (v) => (v === null || v === undefined || v === "" ? null : Number(v));

// The venue_spaces columns availability and pricing read — the dashboard's normalizeVenueSpace, without the client import.
export function spaceFromRow(row) {
  return {
    id: row.id,
    venueId: row.venue_id ?? null,
    name: row.name ?? "",
    capacities: row.capacities && typeof row.capacities === "object" ? row.capacities : {},
    bookable: row.bookable === true,
    rateHourly: num(row.rate_hourly),
    rateHalfDay: num(row.rate_half_day),
    rateFullDay: num(row.rate_full_day),
    currency: row.rate_currency || "GBP",
    minHours: num(row.min_hours) ?? 0,
    bufferMinutes: Number(row.buffer_minutes ?? 0) || 0,
    openingHours: row.opening_hours && typeof row.opening_hours === "object" && !Array.isArray(row.opening_hours) ? row.opening_hours : {},
    blackoutDates: Array.isArray(row.blackout_dates) ? row.blackout_dates : [],
  };
}

// Booking + names → one list or detail row, in the venue's own time zone.
export function bookingView(booking, { spaceName = "", venueName = "", venueAddress = "", eventName = "" } = {}, now = Date.now()) {
  const tz = safeTimeZone(booking.timezone);
  return {
    id: booking.id,
    reference: booking.reference,
    title: booking.title,
    status: booking.status,
    displayStatus: bookingDisplayStatus(booking, now),
    liveHold: isLiveHold(booking, now),
    holdExpiresAt: booking.holdExpiresAt,
    startsAt: booking.startsAt,
    endsAt: booking.endsAt,
    when: `${formatRange(booking.startsAt, booking.endsAt, tz)} ${zoneAbbreviation(booking.startsAt, tz)}`.trim(),
    timezone: tz,
    spaceId: booking.spaceId,
    spaceName,
    venueId: booking.venueId,
    venueName,
    eventId: booking.eventId,
    eventName,
    setupStyle: booking.setupStyle ? setupStyleLabel(booking.setupStyle) : "",
    attendees: booking.attendees,
    total: booking.total,
    currency: booking.currency,
    totalLabel: formatMoney(booking.total, booking.currency),
    priceLines: booking.priceBreakdown.lines.map((line) => ({
      date: line.date,
      amount: formatMoney(line.amount, booking.currency),
      detail: Array.isArray(line.items) && line.items.length ? line.items.map((it) => describeItem(it, booking.currency)).join(" + ") : "No charge",
    })),
    contactName: booking.contactName,
    contactEmail: booking.contactEmail,
    contactPhone: booking.contactPhone,
    notes: booking.notes,
    cancelReason: booking.cancelReason,
    emails: Array.isArray(booking.metadata?.emails) ? booking.metadata.emails.slice(0, 10) : [],
    calendarUrl: booking.status === "cancelled" ? "" : googleCalendarUrl({ booking, spaceName, venueName, address: venueAddress, eventName }),
  };
}

// The dashboard's filter chips: "upcoming" hides cancelled and finished bookings and sorts soonest first.
export function filterBookings(rows, filter, query, now = Date.now()) {
  const q = String(query || "").trim().toLowerCase();
  const kept = rows.filter((b) => {
    if (filter === "upcoming") {
      if (b.status === "cancelled" || new Date(b.endsAt).getTime() <= now) return false;
    } else if (filter && filter !== "all" && b.displayStatus !== filter) {
      return false;
    }
    if (!q) return true;
    return `${b.reference} ${b.title} ${b.spaceName} ${b.venueName} ${b.eventName} ${b.contactName} ${b.contactEmail}`.toLowerCase().includes(q);
  });
  const at = (b) => new Date(b.startsAt).getTime();
  return kept.sort((a, b) => (filter === "upcoming" ? at(a) - at(b) : at(b) - at(a)));
}

// Hours of [start, end) inside [from, to).
const overlapHours = (start, end, from, to) =>
  Math.max(0, Math.min(new Date(end).getTime(), to) - Math.max(new Date(start).getTime(), from)) / HOUR_MS;

export function bookingStats(bookings, now = Date.now()) {
  const confirmed = bookings.filter((b) => b.status === "confirmed");
  const upcoming = confirmed.filter((b) => new Date(b.endsAt).getTime() > now);
  const monthStart = new Date(now);
  monthStart.setDate(1);
  monthStart.setHours(0, 0, 0, 0);
  const monthEnd = new Date(monthStart);
  monthEnd.setMonth(monthEnd.getMonth() + 1);
  const hours = confirmed.reduce((s, b) => s + overlapHours(b.startsAt, b.endsAt, monthStart.getTime(), monthEnd.getTime()), 0);
  const holds = bookings.filter((b) => isLiveHold(b, now));
  const totals = new Map();
  for (const b of confirmed) totals.set(b.currency, (totals.get(b.currency) || 0) + (Number(b.total) || 0));
  const [currency, amount] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0] || ["GBP", 0];
  return {
    upcoming: upcoming.length,
    hoursThisMonth: Math.round(hours * 10) / 10,
    holds: holds.length,
    holdsExpiringSoon: holds.filter((b) => new Date(b.holdExpiresAt).getTime() - now < DAY_MS).length,
    bookedValue: formatMoney(amount, currency),
    otherCurrencies: Math.max(0, totals.size - 1),
  };
}

function text(value, label, max) {
  if (value == null) return "";
  if (typeof value !== "string") throw invalid(`${label} must be text.`);
  const trimmed = value.trim();
  if (trimmed.length > max) throw invalid(`${label} must be ${max} characters or fewer.`);
  return trimmed;
}

// A booking request from the app: venue-local date and clock strings, checked here and priced by the RPC.
export function parseBookingRequest(body) {
  if (!body || typeof body !== "object") throw invalid("Send the booking details.");
  const spaceId = String(body.spaceId || "");
  if (!spaceId) throw invalid("Pick a space.");
  const date = String(body.date || "");
  const endDate = String(body.endDate || body.date || "");
  if (!DATE.test(date) || !DATE.test(endDate)) throw invalid("Dates must be YYYY-MM-DD.");
  if (endDate < date) throw invalid("The end date is before the start date.");
  const startTime = String(body.startTime || "");
  const endTime = String(body.endTime || "");
  if (!CLOCK.test(startTime) || !CLOCK.test(endTime)) throw invalid("Times must be HH:MM.");
  const setupStyle = body.setupStyle ? String(body.setupStyle) : "";
  if (setupStyle && !STYLE_KEYS.includes(setupStyle)) throw invalid("That setup style isn't one of the choices.");
  const attendees = body.attendees === "" || body.attendees == null ? 0 : Number(body.attendees);
  if (!Number.isInteger(attendees) || attendees < 0 || attendees > 1_000_000) throw invalid("Attendees must be a whole number.");
  const contactEmail = text(body.contactEmail, "Contact email", 320).toLowerCase();
  if (contactEmail && !EMAIL.test(contactEmail)) throw invalid("That contact email doesn't look right.");
  const status = body.status === "hold" ? "hold" : "confirmed";
  const holdHours = HOLD_HOURS.includes(Number(body.holdHours)) ? Number(body.holdHours) : 48;
  return {
    spaceId,
    date,
    endDate,
    startTime,
    endTime,
    setupStyle,
    attendees,
    status,
    holdHours,
    eventId: body.eventId ? String(body.eventId) : null,
    title: text(body.title, "Title", 200),
    contactName: text(body.contactName, "Contact name", 200),
    contactEmail,
    contactPhone: text(body.contactPhone, "Contact phone", 60),
    notes: text(body.notes, "Notes", 4000),
    notify: body.notify === true,
  };
}

// Venue-local strings → instants on the venue's clock, as the dashboard's booking dialog builds them.
export function slotInstants(request, timeZone) {
  const tz = safeTimeZone(timeZone);
  const startsAt = zonedInstant(request.date, request.startTime, tz);
  const endsAt = zonedInstant(request.endDate, request.endTime, tz);
  if (!startsAt || !endsAt) throw invalid("Pick a start and end time.");
  return { startsAt, endsAt, timeZone: tz };
}

// The descriptive columns members may edit directly; time, price and status only move through the RPCs.
export function parseBookingPatch(body) {
  if (!body || typeof body !== "object") throw invalid("Send the fields to change.");
  const row = {};
  if ("title" in body) row.title = text(body.title, "Title", 200);
  if ("contactName" in body) row.contact_name = text(body.contactName, "Contact name", 200);
  if ("contactEmail" in body) {
    const email = text(body.contactEmail, "Contact email", 320).toLowerCase();
    if (email && !EMAIL.test(email)) throw invalid("That contact email doesn't look right.");
    row.contact_email = email;
  }
  if ("contactPhone" in body) row.contact_phone = text(body.contactPhone, "Contact phone", 60);
  if ("notes" in body) row.notes = text(body.notes, "Notes", 4000);
  if (!Object.keys(row).length) throw invalid("Send at least one field to change.");
  return row;
}

export const EMAIL_KINDS = ["confirmation", "hold", "cancellation"];
