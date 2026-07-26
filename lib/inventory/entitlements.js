// Entitlement and reservation maths. Pure functions — no React, no DB.
//
// Companion to demand.js. Where demand.js answers "how much will this event
// need?", this answers "how much of it has actually been handed out, and how
// much is spoken for?".
//
// Nothing here decides entitlement — that is derived server-side by the
// issue_* RPCs, which are the single authority (see the design doc, §2). These
// helpers only summarise the resulting ledger for organiser screens.

import { projectedDemand } from "./demand";

// --- Block reasons -----------------------------------------------------------

// Why an entitlement can't be collected right now. Codes come from
// events.issue_state(); the desk shows the label.
export const BLOCK_REASON_MAP = {
  collected: { label: "Already collected", tone: "warning" },
  cap_reached: { label: "Limit reached", tone: "warning" },
  too_soon: { label: "Too soon — collected recently", tone: "warning" },
  outside_window: { label: "Outside the collection window", tone: "muted" },
  outside_event_dates: { label: "Outside the event dates", tone: "muted" },
};

// Why a redeem attempt was refused. These come back from issue_redeem().
export const REDEEM_REASON_MAP = {
  ...BLOCK_REASON_MAP,
  no_permission: { label: "This code can't issue items", tone: "danger" },
  no_override_permission: { label: "This code can't override", tone: "danger" },
  walkup_not_allowed: { label: "Walk-up issuing needs an override code", tone: "danger" },
  unknown_allocation: { label: "That allocation no longer exists", tone: "danger" },
  unknown_subject: { label: "Couldn't find that attendee", tone: "danger" },
  unknown_redemption: { label: "That hand-out no longer exists", tone: "danger" },
  invalid_item: { label: "That item isn't part of this allocation", tone: "danger" },
  out_of_scope: { label: "This code can't issue that item", tone: "danger" },
  not_entitled: { label: "Not entitled to this item", tone: "muted" },
  not_issued: { label: "Already undone", tone: "muted" },
};

export const blockLabel = (reason) =>
  BLOCK_REASON_MAP[reason]?.label || (reason ? "Unavailable" : "");

export const redeemLabel = (reason) =>
  REDEEM_REASON_MAP[reason]?.label || "Couldn't issue — see an organiser.";

// --- Periods -----------------------------------------------------------------

export const PERIOD_MODE_MAP = {
  none: { label: "One per attendee", hint: "A single collection, ever." },
  day: { label: "Per event day", hint: "One collection per day of the event." },
  window: {
    label: "Named windows",
    hint: "One collection per window, and only while a window is open.",
  },
  rolling: {
    label: "Rolling interval",
    hint: "One collection, then a wait before the next.",
  },
};

export const PERIOD_MODE_OPTIONS = [
  { value: "none", label: "One per attendee" },
  { value: "day", label: "Per event day" },
  { value: "window", label: "Named windows" },
  { value: "rolling", label: "Rolling interval" },
];

export const periodModeLabel = (mode) => PERIOD_MODE_MAP[mode]?.label || "One per attendee";

// A human summary of an allocation's collection rule, for list rows.
export function ruleSummary(allocation) {
  const per = Number(allocation?.qtyPerAttendee || 1);
  const unit = per === 1 ? "1 unit" : `${per} units`;
  const cap = Number(allocation?.periodConfig?.totalCap || 0);
  const hours = Number(allocation?.periodConfig?.intervalHours || 0);
  const windows = Array.isArray(allocation?.periodConfig?.windows)
    ? allocation.periodConfig.windows.length
    : 0;

  let base;
  switch (allocation?.periodMode) {
    case "day":
      base = `${unit} per day`;
      break;
    case "window":
      base = `${unit} per window (${windows || "no"} window${windows === 1 ? "" : "s"})`;
      break;
    case "rolling":
      base = hours > 0 ? `${unit} every ${hours}h` : `${unit} per collection`;
      break;
    default:
      base = `${unit} once`;
  }
  return cap > 0 ? `${base} · max ${cap}` : base;
}

// --- Ledger rollups ----------------------------------------------------------

// allocationId -> units handed out (undone rows don't count).
export function redeemedByAllocation(redemptions) {
  const map = new Map();
  for (const r of Array.isArray(redemptions) ? redemptions : []) {
    if (r?.status !== "issued") continue;
    map.set(r.allocationId, (map.get(r.allocationId) || 0) + Number(r.qty || 0));
  }
  return map;
}

// itemId -> units handed out, keyed by the VARIANT that actually left the shelf.
export function redeemedByItem(redemptions) {
  const map = new Map();
  for (const r of Array.isArray(redemptions) ? redemptions : []) {
    if (r?.status !== "issued") continue;
    map.set(r.itemId, (map.get(r.itemId) || 0) + Number(r.qty || 0));
  }
  return map;
}

// Units sold/entitled but not yet collected. This is the reservation: a sale
// doesn't move stock, it only reduces what's left to promise. Never negative —
// handing out more than was sold (overrides, walk-ups) shouldn't read as a
// negative reservation.
export function reservedForAllocation(allocation, event, orders, redemptions) {
  const collected = redeemedByAllocation(redemptions).get(allocation?.id) || 0;
  return Math.max(0, projectedDemand(allocation, event, orders) - collected);
}

// itemId -> reserved units across every open allocation of that item.
export function reservedByItem(allocations, eventsById, orders, redemptions) {
  const collected = redeemedByAllocation(redemptions);
  const map = new Map();
  for (const a of Array.isArray(allocations) ? allocations : []) {
    if (a?.status === "Closed") continue;
    const event = eventsById?.get?.(a.eventId) ?? null;
    const outstanding = Math.max(
      0,
      projectedDemand(a, event, orders) - (collected.get(a.id) || 0),
    );
    if (outstanding > 0) map.set(a.itemId, (map.get(a.itemId) || 0) + outstanding);
  }
  return map;
}

// What's genuinely still sellable: on the shelf, minus what's already promised.
export function availableToPromise(item, reservedMap) {
  const reserved = reservedMap?.get?.(item?.id) || 0;
  return Math.max(0, Number(item?.onHand || 0) - reserved);
}

// Collected-vs-entitled for one allocation, for a progress cell.
export function collectionProgress(allocation, event, orders, redemptions) {
  const entitled = projectedDemand(allocation, event, orders);
  const collected = redeemedByAllocation(redemptions).get(allocation?.id) || 0;
  return {
    entitled,
    collected,
    outstanding: Math.max(0, entitled - collected),
    pct: entitled > 0 ? Math.min(100, Math.round((collected / entitled) * 100)) : 0,
  };
}
