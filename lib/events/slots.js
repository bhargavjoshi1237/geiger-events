// Bookable time-slot helpers for the event storefront + editor.
//
// Slots live in the event's metadata bag (metadata.slots) alongside a master
// metadata.slotBooking config; per-slot sold counts live in metadata.slotsSold
// (keyed by slot id) and are bumped atomically by the buy_ticket RPC — the same
// pattern the per-tier ticket inventory uses. normalizeEvent spreads metadata,
// so a buyer page reads event.slots / event.slotBooking / event.slotsSold
// directly with no extra fetch. Pure functions — no React, no DB.
//
//   slot = {
//     id, label, description,
//     start, end,                 // datetime-local strings
//     band,                       // morning|afternoon|evening|night (auto from start)
//     capacity, priceDelta,
//     allowedTickets: "all" | [ticketId],
//     location, bookingCutoffHours,
//     minPerOrder, maxPerOrder, waitlist, color, enabled,
//   }

// Time-of-day bands. Ranges are inclusive-start; night wraps past midnight.
export const TIME_BANDS = [
  { value: "morning", label: "Morning", hint: "5am – 12pm" },
  { value: "afternoon", label: "Afternoon", hint: "12pm – 5pm" },
  { value: "evening", label: "Evening", hint: "5pm – 9pm" },
  { value: "night", label: "Night", hint: "9pm – 5am" },
];

export const BAND_MAP = TIME_BANDS.reduce((m, b) => ({ ...m, [b.value]: b }), {});

export const bandLabel = (band) => BAND_MAP[band]?.label || "Any time";

// Derive a band from a start time (Date or datetime string). Falls back to
// "afternoon" when the time can't be parsed so a slot always has a sane band.
export function bandFromTime(start) {
  const d = start instanceof Date ? start : parseSlotDate(start);
  if (!d || Number.isNaN(d.getTime())) return "afternoon";
  const h = d.getHours();
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

// Parse a datetime-local string ("2026-07-15T18:00") into a Date. Returns null
// for empty/invalid input rather than an Invalid Date the callers must guard.
export function parseSlotDate(value) {
  if (!value) return null;
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? null : d;
}

export const EMPTY_SLOT = {
  label: "",
  description: "",
  start: "",
  end: "",
  band: "afternoon",
  capacity: 0,
  priceDelta: 0,
  allowedTickets: "all",
  location: "",
  bookingCutoffHours: null,
  minPerOrder: 1,
  maxPerOrder: null,
  waitlist: false,
  color: "",
  enabled: true,
};

// Apply defaults + coerce numerics for a stored slot (older/partial rows).
export function normalizeSlot(slot) {
  if (!slot) return null;
  return {
    ...EMPTY_SLOT,
    ...slot,
    capacity: Number(slot.capacity) || 0,
    priceDelta: Number(slot.priceDelta) || 0,
    minPerOrder: Number(slot.minPerOrder) || 1,
    maxPerOrder: slot.maxPerOrder == null ? null : Number(slot.maxPerOrder) || null,
    bookingCutoffHours:
      slot.bookingCutoffHours == null ? null : Number(slot.bookingCutoffHours) || null,
    enabled: slot.enabled !== false,
  };
}

// Remaining seats for a slot. Capacity 0 = unlimited (Infinity), mirroring the
// event/tier capacity convention.
export function slotRemaining(slot, slotsSold) {
  const cap = Number(slot?.capacity) || 0;
  if (cap <= 0) return Infinity;
  const sold = Number(slotsSold?.[slot.id]) || 0;
  return Math.max(0, cap - sold);
}

// True when the slot's allowedTickets rule admits this ticket tier.
export function slotAllowsTicket(slot, ticketId) {
  const at = slot?.allowedTickets;
  if (at === "all" || !Array.isArray(at) || !at.length) return true;
  return ticketId != null && at.includes(String(ticketId));
}

// Hours until the slot starts, from `now`. Null when the slot has no start.
export function hoursUntilSlot(slot, now = new Date()) {
  const d = parseSlotDate(slot?.start);
  if (!d) return null;
  return (d.getTime() - now.getTime()) / 3600000;
}

// A slot is bookable for a given ticket/qty when it's enabled, admits the
// ticket, isn't past its booking cutoff, and either has room or offers a
// waitlist. Returns a small status object the picker renders from.
export function slotBookingStatus(slot, { ticketId, qty = 1, slotsSold, now = new Date() } = {}) {
  if (!slot || slot.enabled === false) return { bookable: false, reason: "unavailable" };
  if (!slotAllowsTicket(slot, ticketId)) return { bookable: false, reason: "ticket" };
  const hrs = hoursUntilSlot(slot, now);
  if (slot.bookingCutoffHours != null && hrs != null && hrs < Number(slot.bookingCutoffHours)) {
    return { bookable: false, reason: "cutoff" };
  }
  const remaining = slotRemaining(slot, slotsSold);
  if (remaining < qty) {
    if (slot.waitlist) return { bookable: true, waitlisted: true, remaining, reason: "waitlist" };
    return { bookable: false, remaining, reason: "full" };
  }
  return { bookable: true, remaining };
}

// The event's active slots (normalized), optionally filtered to those a given
// ticket tier may book. Order preserved from the editor.
export function eventSlots(event, { ticketId } = {}) {
  const raw = Array.isArray(event?.slots) ? event.slots : [];
  const slots = raw.map(normalizeSlot).filter(Boolean);
  if (ticketId === undefined) return slots;
  return slots.filter((s) => slotAllowsTicket(s, ticketId));
}

// Is slot booking switched on for this event (master toggle + at least one
// enabled slot)?
export function slotBookingEnabled(event) {
  const cfg = event?.slotBooking;
  if (!cfg?.enabled) return false;
  return eventSlots(event).some((s) => s.enabled !== false);
}

export function slotBookingRequired(event) {
  return slotBookingEnabled(event) && event?.slotBooking?.required !== false;
}
