// Inventory rollups and projected demand. Pure functions — no React, no DB.
//
// Two jobs:
//   1. Roll a flat item list into parent/variant groups. Only leaf rows hold
//      stock, so a parent's on-hand and value are summed from its variants.
//   2. Work out how much stock an event allocation will actually need, from the
//      issuance mode:
//        internal — no buyer link; demand is whatever was planned
//        ticket   — every buyer of the linked tickets is entitled to a unit
//        addon    — demand follows sales of the linked purchasable
//
// Demand is read-only: nothing here decrements stock. Stock leaves only when
// someone issues an allocation (lib/supabase/inventory.js → issueAllocation).

import {
  OPEN_ALLOCATION_STATUSES,
  stockStatus,
} from "@/components/internal/screens/inventory/constants";

// --- Item tree ---------------------------------------------------------------

// Group a flat item list into top-level items each carrying their variants.
// Orphaned variants (parent deleted mid-flight) are promoted to top level so
// nothing silently vanishes from the catalog.
export function buildItemTree(items) {
  const list = Array.isArray(items) ? items : [];
  const byId = new Map(list.map((i) => [i.id, i]));
  const childrenOf = new Map();
  const roots = [];

  for (const item of list) {
    if (item.parentId && byId.has(item.parentId)) {
      const bucket = childrenOf.get(item.parentId) || [];
      bucket.push(item);
      childrenOf.set(item.parentId, bucket);
    } else {
      roots.push(item);
    }
  }

  return roots.map((root) => {
    const variants = childrenOf.get(root.id) || [];
    return { ...root, variants, ...rollupItem(root, variants) };
  });
}

// A row's effective stock figures. A parent with variants contributes no stock
// of its own — its numbers are the sum of its children.
export function rollupItem(item, variants) {
  const kids = Array.isArray(variants) ? variants : [];
  if (!kids.length) {
    const onHand = Number(item?.onHand || 0);
    return {
      isGroup: false,
      onHand,
      stockValue: onHand * Number(item?.unitCost || 0),
      reorderPoint: Number(item?.reorderPoint || 0),
      variantCount: 0,
      // A leaf's own status is derived by the screen from on-hand vs reorder.
      worstStatus: stockStatus(onHand, item?.reorderPoint),
    };
  }
  const onHand = kids.reduce((s, v) => s + Number(v.onHand || 0), 0);
  const statuses = kids.map((v) => stockStatus(v.onHand, v.reorderPoint));
  return {
    isGroup: true,
    onHand,
    stockValue: kids.reduce(
      (s, v) => s + Number(v.onHand || 0) * Number(v.unitCost || 0),
      0,
    ),
    reorderPoint: kids.reduce((s, v) => s + Number(v.reorderPoint || 0), 0),
    variantCount: kids.length,
    // A group reports its worst variant, so one healthy size can't mask a size
    // that has run out.
    worstStatus: statuses.includes("Out of stock")
      ? "Out of stock"
      : statuses.includes("Low stock")
        ? "Low stock"
        : "In stock",
  };
}

// The leaf rows that actually hold stock — what movements and POs can target.
export function stockableItems(items) {
  const list = Array.isArray(items) ? items : [];
  const parentIds = new Set(list.filter((i) => i.parentId).map((i) => i.parentId));
  return list.filter((i) => !parentIds.has(i.id));
}

// --- Allocation rollups ------------------------------------------------------

// itemId -> quantity committed to events but not yet issued.
export function allocatedByItem(allocations) {
  const map = new Map();
  for (const a of Array.isArray(allocations) ? allocations : []) {
    if (!OPEN_ALLOCATION_STATUSES.includes(a.status)) continue;
    const outstanding = Math.max(
      0,
      Number(a.plannedQty || 0) - Number(a.issuedQty || 0),
    );
    map.set(a.itemId, (map.get(a.itemId) || 0) + outstanding);
  }
  return map;
}

// --- Projected demand --------------------------------------------------------

// Units sold for one of an event's tickets. The buy_ticket RPC maintains an
// authoritative per-ticket tally on the event's metadata (`ticketSold`); fall
// back to counting orders by ticket name for events predating it.
function ticketSoldCount(event, ticketId, orders) {
  const tally = event?.ticketSold;
  if (tally && typeof tally === "object" && ticketId in tally) {
    return Number(tally[ticketId]) || 0;
  }
  const ticket = (Array.isArray(event?.tickets) ? event.tickets : []).find(
    (t) => t.id === ticketId,
  );
  if (!ticket) return 0;
  return (Array.isArray(orders) ? orders : [])
    .filter((o) => !o.cancelledAt && o.ticket === ticket.name)
    .reduce((s, o) => s + (Number(o.quantity) || 0), 0);
}

// Units of a purchasable sold across an event's live orders. A "perAttendee"
// add-on yields one unit per seat, so its count multiplies by order quantity.
function purchasableSoldCount(event, purchasableId, orders) {
  const definition = (
    Array.isArray(event?.purchasables) ? event.purchasables : []
  ).find((p) => p.id === purchasableId);
  const perAttendee = definition?.priceType === "perAttendee";

  return (Array.isArray(orders) ? orders : [])
    .filter((o) => !o.cancelledAt)
    .reduce((sum, order) => {
      const chosen = Array.isArray(order.purchasables) ? order.purchasables : [];
      const entry = chosen.find((p) => p.id === purchasableId);
      if (!entry) return sum;
      const units = Number(entry.quantity) || 0;
      return sum + (perAttendee ? units * (Number(order.quantity) || 1) : units);
    }, 0);
}

// How much stock this allocation is expected to need. Internal allocations have
// no buyer signal, so the plan is the demand.
export function projectedDemand(allocation, event, orders) {
  if (!allocation) return 0;
  if (allocation.issuance === "ticket") {
    const perAttendee = Number(allocation.qtyPerAttendee) || 0;
    const ids = Array.isArray(allocation.ticketIds) ? allocation.ticketIds : [];
    return ids.reduce(
      (sum, id) => sum + ticketSoldCount(event, id, orders) * perAttendee,
      0,
    );
  }
  if (allocation.issuance === "addon") {
    const perUnit = Number(allocation.qtyPerAttendee) || 1;
    return purchasableSoldCount(event, allocation.purchasableId, orders) * perUnit;
  }
  return Number(allocation.plannedQty) || 0;
}

// Positive when demand outruns what was planned — the number to go buy.
export function allocationShortfall(allocation, event, orders) {
  return Math.max(
    0,
    projectedDemand(allocation, event, orders) - Number(allocation?.plannedQty || 0),
  );
}
