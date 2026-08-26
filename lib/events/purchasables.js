
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

export function isPurchasableVisible(purchasable, ctx = {}) {
  const p = normalizePurchasable(purchasable);
  if (!p || !p.enabled) return false;
  const rules = activeRules(p.showIf);
  if (!rules.length) return true;
  const results = rules.map(([kind, s]) => evalRule(kind, s, ctx));
  return p.showIf.match === "any" ? results.some(Boolean) : results.every(Boolean);
}

export function visiblePurchasables(event, ctx = {}) {
  const raw = Array.isArray(event?.purchasables) ? event.purchasables : [];
  return raw
    .map(normalizePurchasable)
    .filter(Boolean)
    .filter((p) => isPurchasableVisible(p, { ...ctx, selectedIds: ctx.selectedIds || [] }));
}

export function hasPurchasables(event) {
  return Array.isArray(event?.purchasables) && event.purchasables.some((p) => p?.enabled !== false);
}

export function purchasableUnitPrice(purchasable, selection) {
  const p = normalizePurchasable(purchasable);
  if (!p) return 0;
  if (p.pickType === "quantity") return p.price * (Number(selection) || 0);
  return selection ? p.price : 0;
}

export function purchasablesUnitTotal(purchasables, selections) {
  return (purchasables || []).reduce(
    (sum, p) => sum + purchasableUnitPrice(p, selections?.[p.id]),
    0,
  );
}

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
