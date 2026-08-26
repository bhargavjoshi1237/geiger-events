
import {
  OPEN_ALLOCATION_STATUSES,
  stockStatus,
} from "@/components/internal/screens/inventory/constants";

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
    worstStatus: statuses.includes("Out of stock")
      ? "Out of stock"
      : statuses.includes("Low stock")
        ? "Low stock"
        : "In stock",
  };
}

export function stockableItems(items) {
  const list = Array.isArray(items) ? items : [];
  const parentIds = new Set(list.filter((i) => i.parentId).map((i) => i.parentId));
  return list.filter((i) => !parentIds.has(i.id));
}

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

export function allocationShortfall(allocation, event, orders) {
  return Math.max(
    0,
    projectedDemand(allocation, event, orders) - Number(allocation?.plannedQty || 0),
  );
}
