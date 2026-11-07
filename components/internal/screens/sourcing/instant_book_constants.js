// Lookups and small formatters for Instant Book. Config only — rows come from lib/supabase/venue_bookings.js.

import { formatMoney } from "@/lib/venue_booking/pricing";

export const BOOKING_STATUS_MAP = {
  Confirmed: { label: "Confirmed", variant: "success", dotClass: "bg-emerald-400" },
  Hold: { label: "Hold", variant: "warning", dotClass: "bg-amber-400" },
  "Hold expired": { label: "Hold expired", variant: "outline", dotClass: "bg-text-tertiary" },
  Completed: { label: "Completed", variant: "neutral", dotClass: "bg-zinc-400" },
  Cancelled: { label: "Cancelled", variant: "danger", dotClass: "bg-red-400" },
};

export const BOOKING_FILTER_OPTIONS = [
  { value: "all", label: "All Bookings" },
  { value: "upcoming", label: "Upcoming" },
  { value: "Hold", label: "Holds" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Hold expired", label: "Expired holds" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
];

export const HOLD_OPTIONS = [
  { value: "24", label: "24 hours" },
  { value: "48", label: "48 hours" },
  { value: "72", label: "3 days" },
  { value: "168", label: "7 days" },
];

export const EMAIL_KIND_LABELS = {
  confirmation: "Confirmation",
  hold: "Hold notice",
  cancellation: "Cancellation",
};

// Sum per currency -> the dominant currency's figure plus how many others exist.
export function moneyByCurrency(rows) {
  const totals = new Map();
  for (const r of rows) totals.set(r.currency, (totals.get(r.currency) || 0) + (Number(r.total) || 0));
  if (!totals.size) return { value: formatMoney(0, "GBP"), others: 0 };
  const [currency, amount] = [...totals.entries()].sort((a, b) => b[1] - a[1])[0];
  return { value: formatMoney(amount, currency), others: totals.size - 1 };
}

export function formatHours(hours) {
  const h = Math.round((Number(hours) || 0) * 10) / 10;
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`;
}
