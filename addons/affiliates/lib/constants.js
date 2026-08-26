
export const currency = (n) => `$${Number(n || 0).toLocaleString("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
})}`;

export const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return String(iso);
  return d.toLocaleDateString("en-US", {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const AFFILIATE_STATUS_MAP = {
  invited: { label: "Invited", dotClass: "bg-amber-400" },
  active: { label: "Active", dotClass: "bg-emerald-400" },
  suspended: { label: "Suspended", dotClass: "bg-red-400" },
};

export const PROGRAM_STATUS_MAP = {
  draft: { label: "Draft", dotClass: "bg-slate-400" },
  active: { label: "Active", dotClass: "bg-emerald-400" },
  paused: { label: "Paused", dotClass: "bg-amber-400" },
  ended: { label: "Ended", dotClass: "bg-slate-400" },
};

export const COMMISSION_STATE_MAP = {
  pending: { label: "Pending", dotClass: "bg-amber-400" },
  approved: { label: "Approved", dotClass: "bg-blue-400" },
  paid: { label: "Paid", dotClass: "bg-emerald-400" },
  reversed: { label: "Reversed", dotClass: "bg-red-400" },
};

export const PAYOUT_STATE_MAP = {
  draft: { label: "Draft", dotClass: "bg-slate-400" },
  sent: { label: "Sent", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", dotClass: "bg-red-400" },
};

export const AFFILIATE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "invited", label: "Invited" },
  { value: "active", label: "Active" },
  { value: "suspended", label: "Suspended" },
];

export const PROGRAM_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "paused", label: "Paused" },
  { value: "ended", label: "Ended" },
];

export const COMMISSION_STATE_FILTER_OPTIONS = [
  { value: "all", label: "All states" },
  { value: "pending", label: "Pending" },
  { value: "approved", label: "Approved" },
  { value: "paid", label: "Paid" },
  { value: "reversed", label: "Reversed" },
];

export const RATE_MODEL_OPTIONS = [
  { value: "percent", label: "Percent of ticket revenue" },
  { value: "flat_per_ticket", label: "Flat amount per ticket" },
  { value: "flat_per_order", label: "Flat amount per order" },
];

export const COMMISSION_BASE_OPTIONS = [
  { value: "tickets", label: "Tickets only" },
  { value: "tickets_addons", label: "Tickets + add-ons" },
];

export const DISCOUNT_HANDLING_OPTIONS = [
  { value: "post", label: "After the discount" },
  { value: "pre", label: "Before the discount" },
];

export function formatRate(model, value) {
  const n = Number(value || 0);
  if (model === "percent") return `${n}%`;
  if (model === "flat_per_ticket") return `${currency(n)} / ticket`;
  if (model === "flat_per_order") return `${currency(n)} / order`;
  return "—";
}

export const ATTRIBUTION_REASONS = {
  empty: "No referral link or code was present.",
  no_program: "This event has no affiliate program.",
  inactive: "The program isn't active.",
  not_started: "The program hasn't started yet.",
  ended: "The program has ended.",
  invalid: "The link or code didn't match an affiliate.",
  suspended: "That affiliate is paused.",
  self_referral: "The buyer is the affiliate — self-referral is blocked.",
  free_ticket: "Free tickets are excluded from this program.",
  discounted: "Already-discounted orders are excluded.",
  excluded_ticket_type: "That ticket type is excluded.",
  below_minimum: "The order is below the program's minimum value.",
  no_rate: "The affiliate has no tier or rate set.",
  zero_amount: "The calculated commission was zero.",
  affiliate_cap: "That affiliate has hit their commission cap.",
  budget_exhausted: "The program's commission budget is spent.",
  already_attributed: "This order was already attributed.",
};

export function slugify(value, fallback = "aff") {
  const out = String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 32);
  return out || fallback;
}
