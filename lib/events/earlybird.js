// Early-bird pricing for the ticket checkout.
//
// Config lives in the event metadata bag (metadata.earlybird) and is gated by the
// per-event ticketRules.earlybird flag. When enabled and the current time falls
// inside the [startAt, endAt] window, every ticket's price is reduced by a percent
// or a flat amount. The reduction is ALWAYS re-derived server-side (the buy_ticket
// RPC uses the DB clock) — the client only computes a preview and never sends a
// pre-reduced price. Pure functions — no React, no DB.
//
//   metadata.earlybird = {
//     mode: "percent" | "flat",
//     percent, amount,            // whichever `mode` selects
//     startAt, endAt,             // datetime-local strings; blank = open-ended
//     note,
//   }

export const EMPTY_EARLYBIRD = {
  mode: "percent",
  percent: 15,
  amount: 0,
  startAt: "",
  endAt: "",
  note: "",
};

export function normalizeEarlybird(cfg) {
  const c = { ...EMPTY_EARLYBIRD, ...(cfg || {}) };
  return {
    ...c,
    mode: c.mode === "flat" ? "flat" : "percent",
    percent: Number(c.percent) || 0,
    amount: Number(c.amount) || 0,
  };
}

// Is early-bird switched on for this event (per-event opt-in + a configured
// reduction)? The global Tickets setting governs availability of the toggle.
export function earlybirdEnabled(event) {
  if (!event?.ticketRules?.earlybird) return false;
  const c = normalizeEarlybird(event.earlybird);
  return c.mode === "flat" ? c.amount > 0 : c.percent > 0;
}

// Is `now` inside the configured window? A blank bound is open on that side.
export function earlybirdActive(event, now = new Date()) {
  if (!earlybirdEnabled(event)) return false;
  const c = normalizeEarlybird(event.earlybird);
  const t = now.getTime();
  if (c.startAt) {
    const s = new Date(c.startAt).getTime();
    if (!Number.isNaN(s) && t < s) return false;
  }
  if (c.endAt) {
    const e = new Date(c.endAt).getTime();
    if (!Number.isNaN(e) && t > e) return false;
  }
  return true;
}

// Per-ticket reduction (never below zero, never above the price), rounded to
// cents. Mirror of the SQL math so client preview, Stripe, and the RPC agree.
export function earlybirdReduction(event, price, now = new Date()) {
  if (!earlybirdActive(event, now)) return 0;
  const c = normalizeEarlybird(event.earlybird);
  const p = Number(price) || 0;
  if (p <= 0) return 0;
  const raw = c.mode === "flat" ? c.amount : (p * c.percent) / 100;
  return Math.max(0, Math.min(Math.round(raw * 100) / 100, p));
}

// The effective (post-early-bird) unit price for a ticket right now.
export function earlybirdPrice(event, price, now = new Date()) {
  const p = Number(price) || 0;
  return Math.max(0, p - earlybirdReduction(event, p, now));
}

// Short label for the badge/preview ("15% off" / "$10 off").
export function earlybirdLabel(event) {
  const c = normalizeEarlybird(event?.earlybird);
  return c.mode === "flat" ? `$${c.amount} off` : `${c.percent}% off`;
}
