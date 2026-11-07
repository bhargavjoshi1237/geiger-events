// Venue space pricing — mirrors events.venue_booking_price_day() in SQL; the server re-prices every booking.
// Each venue-local day is priced on its billable hours (overlap with opening hours, rounded up to the
// half hour) as the cheapest of: one full day, or n half-day blocks plus hourly for the remainder.

export const HALF_DAY_HOURS = 4;

export const RATE_KINDS = {
  full_day: "Full day",
  half_day: "Half day",
  hourly: "Hourly",
};

const rate = (v) => (v === null || v === undefined || v === "" || !Number.isFinite(Number(v)) ? null : Math.max(0, Number(v)));

const round2 = (n) => Math.round(n * 100) / 100;

// The rate card of a normalized venue space.
export function ratesOf(space) {
  return {
    hourly: rate(space?.rateHourly),
    halfDay: rate(space?.rateHalfDay),
    fullDay: rate(space?.rateFullDay),
    currency: space?.currency || "GBP",
  };
}

export function hasRates(rates) {
  return rates?.hourly != null || rates?.halfDay != null || rates?.fullDay != null;
}

// Bill partial hours to the next half hour.
export function billableHours(minutes) {
  return Math.ceil(Math.max(0, minutes) / 30) / 2;
}

// Cheapest valid combination for one day's billable hours.
export function priceDay(hours, rates) {
  if (!(hours > 0)) return { amount: 0, items: [] };
  const hourly = rate(rates?.hourly);
  const half = rate(rates?.halfDay);
  const full = rate(rates?.fullDay);
  let best = null;
  if (full != null) {
    best = { amount: full, items: [{ kind: "full_day", qty: 1, unit: full, amount: full }] };
  }
  const maxHalf = half != null ? Math.ceil(hours / HALF_DAY_HOURS) : 0;
  for (let n = 0; n <= maxHalf; n += 1) {
    const rem = Math.max(0, hours - HALF_DAY_HOURS * n);
    if (rem > 0 && hourly == null) continue;
    if (n === 0 && rem === 0) continue;
    const amount = n * (half ?? 0) + rem * (hourly ?? 0);
    if (best == null || amount < best.amount) {
      const items = [];
      if (n > 0) items.push({ kind: "half_day", qty: n, unit: half, amount: round2(n * half) });
      if (rem > 0) items.push({ kind: "hourly", qty: rem, unit: hourly, amount: round2(rem * hourly) });
      best = { amount, items };
    }
  }
  return best ? { amount: round2(best.amount), items: best.items } : { amount: 0, items: [] };
}

// Prices the per-day segments produced by evaluateSlot().
export function priceSegments(segments, rates) {
  const lines = (segments || []).map((seg) => {
    const hours = billableHours(seg.billableMinutes);
    const { amount, items } = priceDay(hours, rates);
    return { date: seg.date, hours, amount, items };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  return {
    currency: rates?.currency || "GBP",
    priced: hasRates(rates),
    lines,
    hours: lines.reduce((s, l) => s + l.hours, 0),
    subtotal,
    total: subtotal,
  };
}

export function formatMoney(amount, currency = "GBP") {
  const value = Number(amount) || 0;
  try {
    return new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: String(currency || "GBP").toUpperCase(),
      minimumFractionDigits: Number.isInteger(value) ? 0 : 2,
      maximumFractionDigits: 2,
    }).format(value);
  } catch {
    return `${String(currency || "").toUpperCase()} ${value.toFixed(2)}`;
  }
}

export function describeItem(item, currency) {
  const label = RATE_KINDS[item.kind] || item.kind;
  if (item.kind === "hourly") return `${item.qty} h × ${formatMoney(item.unit, currency)}`;
  if (item.kind === "half_day") return `${item.qty} × ${label.toLowerCase()} (${formatMoney(item.unit, currency)})`;
  return `${label} (${formatMoney(item.unit, currency)})`;
}

// One-line rate card, e.g. "£80/h · £300 half day · £520 day".
export function rateSummary(space) {
  const r = ratesOf(space);
  const parts = [];
  if (r.hourly != null) parts.push(`${formatMoney(r.hourly, r.currency)}/h`);
  if (r.halfDay != null) parts.push(`${formatMoney(r.halfDay, r.currency)} half day`);
  if (r.fullDay != null) parts.push(`${formatMoney(r.fullDay, r.currency)} day`);
  return parts.join(" · ");
}
