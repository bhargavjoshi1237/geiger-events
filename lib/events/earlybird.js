
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

export function earlybirdEnabled(event) {
  if (!event?.ticketRules?.earlybird) return false;
  const c = normalizeEarlybird(event.earlybird);
  return c.mode === "flat" ? c.amount > 0 : c.percent > 0;
}

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

export function earlybirdReduction(event, price, now = new Date()) {
  if (!earlybirdActive(event, now)) return 0;
  const c = normalizeEarlybird(event.earlybird);
  const p = Number(price) || 0;
  if (p <= 0) return 0;
  const raw = c.mode === "flat" ? c.amount : (p * c.percent) / 100;
  return Math.max(0, Math.min(Math.round(raw * 100) / 100, p));
}

export function earlybirdPrice(event, price, now = new Date()) {
  const p = Number(price) || 0;
  return Math.max(0, p - earlybirdReduction(event, p, now));
}

export function earlybirdLabel(event) {
  const c = normalizeEarlybird(event?.earlybird);
  return c.mode === "flat" ? `$${c.amount} off` : `${c.percent}% off`;
}
