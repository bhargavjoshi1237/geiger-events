// Per-ticket discount codes + the priority rule engine.
//
// A coupon is a ticketing_records row (module "discount", kind "coupon"). It is
// scoped to TICKETS, not events: a code only works on a ticket that lists its id
// in metadata.tickets[].discountIds. That list is the single source of truth for
// "which codes work here" — events.metadata.attached.discount is legacy and is
// only read by the back-fill migration.
//
// How much a coupon gives is decided by an ORDERED rule list. Rules are
// evaluated top to bottom and the FIRST match wins — so the organiser drags the
// most specific rule to the top. If no rule matches, the coupon's base
// discount (config.discountType / config.value) applies as the catch-all.
//
// This module is pure and isomorphic: the public checkout preview, the Stripe
// session builder, and the portal all call it, and buy_ticket mirrors it
// server-side (see supabase/migrations/20260830*_ticket_discount_rules.sql).
// Keep the two in step — the SQL is authoritative for money, this is
// authoritative for preview.

export const EMPTY_DISCOUNT_RULE = {
  id: "",
  label: "",
  minQty: null, // null = no lower bound
  maxQty: null, // null = no upper bound
  validFrom: "", // datetime-local string; "" = open-ended
  validUntil: "", // datetime-local string; "" = open-ended
  discountType: "percent", // percent | flat
  value: 0,
  applyPer: "order", // order (once) | ticket (× quantity) — flat amounts only
};

// Coupon config factory. Returned by a function (not a shared literal) so
// nested objects are never shared between records.
export function defaultCouponConfig() {
  return {
    code: "",
    discountType: "percent",
    value: 10,
    usageLimit: 0, // 0 = unlimited
    applyPer: "order",
    maxDiscount: null, // null = uncapped; otherwise a currency ceiling
    // Eligibility gates. Failing one rejects the code outright rather than
    // falling back to a smaller discount.
    minQty: null,
    maxQty: null,
    validFrom: "",
    validUntil: "",
    // Ordered amount rules — first match wins, falls through to the base.
    rules: [],
  };
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
};

const parseWhen = (v) => {
  if (!v) return null;
  const t = new Date(v).getTime();
  return Number.isNaN(t) ? null : t;
};

export function normalizeRule(rule) {
  const r = { ...EMPTY_DISCOUNT_RULE, ...(rule || {}) };
  return {
    ...r,
    minQty: num(r.minQty),
    maxQty: num(r.maxQty),
    value: Number(r.value) || 0,
    discountType: r.discountType === "flat" ? "flat" : "percent",
    applyPer: r.applyPer === "ticket" ? "ticket" : "order",
    validFrom: r.validFrom || "",
    validUntil: r.validUntil || "",
  };
}

export function normalizeCoupon(cfg) {
  const c = { ...defaultCouponConfig(), ...(cfg || {}) };
  return {
    ...c,
    value: Number(c.value) || 0,
    usageLimit: Math.max(0, Number(c.usageLimit) || 0),
    applyPer: c.applyPer === "ticket" ? "ticket" : "order",
    maxDiscount: num(c.maxDiscount),
    minQty: num(c.minQty),
    maxQty: num(c.maxQty),
    validFrom: c.validFrom || "",
    validUntil: c.validUntil || "",
    discountType: c.discountType === "flat" ? "flat" : "percent",
    rules: (Array.isArray(c.rules) ? c.rules : []).map(normalizeRule),
  };
}

// --- Ticket scoping ----------------------------------------------------------

// The coupon record ids a ticket accepts. Stored as
// events.metadata.tickets[].discountIds.
export function ticketDiscountIds(ticket) {
  const ids = ticket?.discountIds;
  if (!Array.isArray(ids)) return [];
  return ids.filter(Boolean).map(String);
}

// Hard cutover: a code works on a ticket only when that ticket lists it.
export function couponAppliesToTicket(ticket, recordId) {
  if (!recordId) return false;
  return ticketDiscountIds(ticket).includes(String(recordId));
}

// --- Conditions --------------------------------------------------------------

// Does `rule`'s window/quantity conditions hold for this basket?
// ctx: { qty, now }
export function ruleMatches(rule, ctx = {}) {
  const r = normalizeRule(rule);
  const qty = Math.max(1, Number(ctx.qty) || 1);
  const now = ctx.now instanceof Date ? ctx.now.getTime() : Number(ctx.now) || Date.now();

  if (r.minQty != null && qty < r.minQty) return false;
  if (r.maxQty != null && qty > r.maxQty) return false;

  const from = parseWhen(r.validFrom);
  if (from != null && now < from) return false;
  const until = parseWhen(r.validUntil);
  if (until != null && now > until) return false;

  return true;
}

// Why a code is unusable, or null when it passes every gate.
// ctx: { qty, now, used, ticket }
export function couponRejection(coupon, ctx = {}) {
  const c = normalizeCoupon(coupon);
  const qty = Math.max(1, Number(ctx.qty) || 1);
  const now = ctx.now instanceof Date ? ctx.now.getTime() : Number(ctx.now) || Date.now();

  if (ctx.ticket && !couponAppliesToTicket(ctx.ticket, ctx.recordId))
    return "not_allowed";

  if (c.usageLimit > 0 && Number(ctx.used) >= c.usageLimit) return "limit";

  const from = parseWhen(c.validFrom);
  if (from != null && now < from) return "pending";
  const until = parseWhen(c.validUntil);
  if (until != null && now > until) return "expired";

  if (c.minQty != null && qty < c.minQty) return "min_qty";
  if (c.maxQty != null && qty > c.maxQty) return "max_qty";

  return null;
}

// --- Reward resolution -------------------------------------------------------

// Walk the ordered rules top-down; the first match wins. Nothing matching means
// the base discount is used as the catch-all.
// Returns { discountType, value, applyPer, ruleId, label, matched }.
export function resolveReward(coupon, ctx = {}) {
  const c = normalizeCoupon(coupon);
  const rules = c.rules || [];
  for (const rule of rules) {
    if (!ruleMatches(rule, ctx)) continue;
    return {
      discountType: rule.discountType,
      value: Number(rule.value) || 0,
      applyPer: rule.applyPer,
      ruleId: rule.id || null,
      label: rule.label || "",
      matched: true,
    };
  }
  return {
    discountType: c.discountType,
    value: Number(c.value) || 0,
    applyPer: c.applyPer,
    ruleId: null,
    label: "",
    matched: false,
  };
}

// --- Money -------------------------------------------------------------------

const money = (n) => Math.round((Number(n) || 0) * 100) / 100;

// The discount in currency. `reward` is a resolveReward() result (or anything
// shaped like { discountType, value, applyPer }); `base` is the amount the
// percentage is taken from; `maxDiscount` clips the result.
//
// Mirrored exactly in SQL by events.resolve_ticket_discount().
export function discountAmountFor(reward, { base, qty = 1, maxDiscount = null } = {}) {
  if (!reward) return 0;
  const b = Math.max(0, Number(base) || 0);
  if (b <= 0) return 0;

  const value = Number(reward.value) || 0;
  const per = reward.applyPer === "ticket" ? "ticket" : "order";
  const units = per === "ticket" ? Math.max(1, Number(qty) || 1) : 1;

  let amount;
  if (reward.discountType === "flat") {
    amount = value * units;
  } else {
    // Percent is taken off the whole base once — applyPer has no effect on it.
    amount = (b * value) / 100;
  }

  amount = Math.max(0, Math.min(amount, b));
  const cap = num(maxDiscount);
  if (cap != null && cap >= 0) amount = Math.min(amount, cap);
  return money(amount);
}

// --- Summaries ---------------------------------------------------------------

// Short human description of a single rule's conditions, e.g. "3–5 tickets".
export function ruleConditionLabel(rule) {
  const r = normalizeRule(rule);
  const parts = [];
  if (r.minQty != null && r.maxQty != null)
    parts.push(`${r.minQty}–${r.maxQty} tickets`);
  else if (r.minQty != null) parts.push(`${r.minQty}+ tickets`);
  else if (r.maxQty != null) parts.push(`up to ${r.maxQty} tickets`);

  if (r.validFrom || r.validUntil) {
    const fmt = (v) => {
      const t = parseWhen(v);
      if (t == null) return "—";
      return new Date(t).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
    };
    parts.push(
      r.validFrom && r.validUntil
        ? `${fmt(r.validFrom)} → ${fmt(r.validUntil)}`
        : r.validUntil
          ? `until ${fmt(r.validUntil)}`
          : `from ${fmt(r.validFrom)}`,
    );
  }

  return parts.length ? parts.join(" · ") : "Always";
}

export function ruleValueLabel(rule) {
  const r = normalizeRule(rule);
  if (r.discountType === "flat") {
    return `$${r.value} off${r.applyPer === "ticket" ? " per ticket" : ""}`;
  }
  return `${r.value}% off`;
}

// One-line summary for the coupon card in the Discounts list.
export function couponSummary(coupon) {
  const c = normalizeCoupon(coupon);
  const base = c.discountType === "flat" ? `$${c.value}` : `${c.value}%`;
  const gates = [];
  if (c.minQty != null) gates.push(`${c.minQty}+ tickets`);
  if (c.maxQty != null) gates.push(`max ${c.maxQty}`);
  if (c.validUntil) gates.push(`until ${c.validUntil.slice(0, 10)}`);
  const n = c.rules.length;
  return [
    c.code || "no code",
    `${base} off`,
    n ? `${n} rule${n > 1 ? "s" : ""}` : null,
    ...gates,
  ]
    .filter(Boolean)
    .join(" | ");
}
