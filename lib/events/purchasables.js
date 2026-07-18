// Additional purchasables (conditional add-ons) for the ticket checkout.
//
// Purchasables live in the event's metadata bag (metadata.purchasables). Unlike
// legacy Offerings they carry a fully-configurable `showIf` condition set that
// gates when the buyer sees them — by the selected slot's time band, specific
// slots, ticket tier, cart quantity, membership, a booking cutoff, or a
// dependency on / mutual-exclusion with another purchasable. The buyer picks
// them in the animated add-ons step; their price folds into the order add-on
// total and the chosen items persist on the order metadata. Pure functions —
// no React, no DB.
//
//   purchasable = {
//     id, name, description, image,
//     price, priceType: "flat" | "perAttendee",
//     pickType: "toggle" | "quantity",
//     required, stock, maxPerOrder, enabled,
//     showIf: {
//       match: "all" | "any",
//       bands: [], slotIds: [], tickets: "all" | [ticketId],
//       minQty, maxQty, membersOnly, cutoffHours,
//       requiresPurchasableId, excludesPurchasableId,
//     },
//   }

import { hoursUntilSlot } from "./slots";

export const EMPTY_SHOWIF = {
  match: "all",
  bands: [],
  slotIds: [],
  tickets: "all",
  minQty: null,
  maxQty: null,
  membersOnly: false,
  cutoffHours: null,
  requiresPurchasableId: null,
  excludesPurchasableId: null,
};

export const EMPTY_PURCHASABLE = {
  name: "",
  description: "",
  image: "",
  price: 0,
  priceType: "flat",
  pickType: "toggle",
  required: false,
  stock: null,
  maxPerOrder: null,
  enabled: true,
  showIf: { ...EMPTY_SHOWIF },
};

// Apply defaults + coerce a stored purchasable (older/partial rows).
export function normalizePurchasable(p) {
  if (!p) return null;
  return {
    ...EMPTY_PURCHASABLE,
    ...p,
    price: Number(p.price) || 0,
    stock: p.stock == null ? null : Number(p.stock) || null,
    maxPerOrder: p.maxPerOrder == null ? null : Number(p.maxPerOrder) || null,
    enabled: p.enabled !== false,
    showIf: { ...EMPTY_SHOWIF, ...(p.showIf || {}) },
  };
}

// Which of a showIf's rules are actually constraining (an unset rule doesn't
// count toward match all/any). Keeps "no conditions → always visible" working.
function activeRules(showIf) {
  const s = { ...EMPTY_SHOWIF, ...(showIf || {}) };
  const rules = [];
  if (Array.isArray(s.bands) && s.bands.length) rules.push(["bands", s]);
  if (Array.isArray(s.slotIds) && s.slotIds.length) rules.push(["slotIds", s]);
  if (s.tickets !== "all" && Array.isArray(s.tickets) && s.tickets.length)
    rules.push(["tickets", s]);
  if (s.minQty != null) rules.push(["minQty", s]);
  if (s.maxQty != null) rules.push(["maxQty", s]);
  if (s.membersOnly) rules.push(["membersOnly", s]);
  if (s.cutoffHours != null) rules.push(["cutoffHours", s]);
  if (s.requiresPurchasableId) rules.push(["requires", s]);
  if (s.excludesPurchasableId) rules.push(["excludes", s]);
  return rules;
}

// Evaluate a single rule against the checkout context.
function evalRule(kind, s, ctx) {
  const { slot, ticketId, qty = 1, isMember = false, now = new Date(), selectedIds = [] } = ctx;
  switch (kind) {
    case "bands":
      return !!slot && s.bands.includes(slot.band);
    case "slotIds":
      return !!slot && s.slotIds.includes(slot.id);
    case "tickets":
      return ticketId != null && s.tickets.includes(String(ticketId));
    case "minQty":
      return qty >= Number(s.minQty);
    case "maxQty":
      return qty <= Number(s.maxQty);
    case "membersOnly":
      return !!isMember;
    case "cutoffHours": {
      // Only meaningful with a selected slot; hide once inside the cutoff window.
      if (!slot) return false;
      const hrs = hoursUntilSlot(slot, now);
      return hrs == null || hrs >= Number(s.cutoffHours);
    }
    case "requires":
      return selectedIds.includes(s.requiresPurchasableId);
    case "excludes":
      return !selectedIds.includes(s.excludesPurchasableId);
    default:
      return true;
  }
}

// Is this purchasable visible in the given checkout context? No active rules →
// always visible. match:"any" needs one rule true; match:"all" needs every one.
export function isPurchasableVisible(purchasable, ctx = {}) {
  const p = normalizePurchasable(purchasable);
  if (!p || !p.enabled) return false;
  const rules = activeRules(p.showIf);
  if (!rules.length) return true;
  const results = rules.map(([kind, s]) => evalRule(kind, s, ctx));
  return p.showIf.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

// The event's purchasables visible for the current context, in editor order.
export function visiblePurchasables(event, ctx = {}) {
  const raw = Array.isArray(event?.purchasables) ? event.purchasables : [];
  return raw
    .map(normalizePurchasable)
    .filter(Boolean)
    .filter((p) => isPurchasableVisible(p, { ...ctx, selectedIds: ctx.selectedIds || [] }));
}

// Does the event have any purchasables configured at all (drives whether the
// legacy inline Offerings block is hidden in the checkout)?
export function hasPurchasables(event) {
  return Array.isArray(event?.purchasables) && event.purchasables.some((p) => p?.enabled !== false);
}

// Per-ticket price contributed by a single purchasable given its selection.
// toggle → price when chosen; quantity → price × chosen count.
export function purchasableUnitPrice(purchasable, selection) {
  const p = normalizePurchasable(purchasable);
  if (!p) return 0;
  if (p.pickType === "quantity") return p.price * (Number(selection) || 0);
  return selection ? p.price : 0;
}

// Sum the per-ticket add-on cost across a selections map { [id]: value }.
export function purchasablesUnitTotal(purchasables, selections) {
  return (purchasables || []).reduce(
    (sum, p) => sum + purchasableUnitPrice(p, selections?.[p.id]),
    0,
  );
}

// Readable record of chosen purchasables for the order metadata bag.
export function buildPurchasableSelections(purchasables, selections) {
  return (purchasables || [])
    .map((p) => {
      const sel = selections?.[p.id];
      const count = p.pickType === "quantity" ? Number(sel) || 0 : sel ? 1 : 0;
      if (!count) return null;
      return {
        id: p.id,
        name: p.name,
        pickType: p.pickType,
        quantity: count,
        price: Number(p.price) || 0,
        total: purchasableUnitPrice(p, sel),
      };
    })
    .filter(Boolean);
}
