// Lookups, option lists, and formatters for the Orders area.
// Config only — never row data.

// --- Formatters --------------------------------------------------------------

export const currency = (n) => {
  const v = Number(n || 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

export const formatDate = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

export const formatDateTime = (iso) => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString(undefined, {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
};

// A short, human order reference derived from the UUID (orders have no numeric
// column). Prefix is configurable in Order Settings; this is the fallback.
export const orderRef = (id, prefix = "ORD") =>
  id ? `${prefix}-${String(id).replace(/-/g, "").slice(0, 6).toUpperCase()}` : "—";

// --- Order display status (derived in lib/supabase/orders.js) -----------------

export const ORDER_STATUS_MAP = {
  Paid: { label: "Paid", variant: "success", dotClass: "bg-emerald-400" },
  "Partially refunded": {
    label: "Partially refunded",
    variant: "warning",
    dotClass: "bg-amber-400",
  },
  Refunded: { label: "Refunded", variant: "neutral", dotClass: "bg-zinc-400" },
  Cancelled: { label: "Cancelled", variant: "danger", dotClass: "bg-red-400" },
  Disputed: { label: "Disputed", variant: "warning", dotClass: "bg-orange-400" },
};

export const ORDER_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Paid", label: "Paid" },
  { value: "Partially refunded", label: "Partially refunded" },
  { value: "Refunded", label: "Refunded" },
  { value: "Cancelled", label: "Cancelled" },
];

// --- Refunds -----------------------------------------------------------------

export const REFUND_STATUS_MAP = {
  Requested: { label: "Requested", variant: "warning", dotClass: "bg-amber-400" },
  Approved: { label: "Approved", variant: "info", dotClass: "bg-sky-400" },
  Denied: { label: "Denied", variant: "danger", dotClass: "bg-red-400" },
  Issued: { label: "Issued", variant: "success", dotClass: "bg-emerald-400" },
};

export const REFUND_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All refunds" },
  { value: "Requested", label: "Requested" },
  { value: "Approved", label: "Approved" },
  { value: "Denied", label: "Denied" },
  { value: "Issued", label: "Issued" },
];

export const REFUND_REASON_OPTIONS = [
  { value: "duplicate", label: "Duplicate" },
  { value: "requested_by_customer", label: "Requested by customer" },
  { value: "event_cancelled", label: "Event cancelled" },
  { value: "fraudulent", label: "Fraudulent" },
  { value: "other", label: "Other" },
];

export const REFUND_METHOD_OPTIONS = [
  { value: "original", label: "Original payment" },
  { value: "credit", label: "Store credit" },
  { value: "manual", label: "Manual / cash" },
];

export const reasonLabel = (code) =>
  REFUND_REASON_OPTIONS.find((r) => r.value === code)?.label || "Other";

export const methodLabel = (value) =>
  REFUND_METHOD_OPTIONS.find((m) => m.value === value)?.label || "Original payment";

// --- Transactions ------------------------------------------------------------

export const TRANSACTION_TYPE_MAP = {
  Charge: { label: "Charge", variant: "success", dotClass: "bg-emerald-400" },
  Refund: { label: "Refund", variant: "danger", dotClass: "bg-red-400" },
};

export const TRANSACTION_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All transactions" },
  { value: "Charge", label: "Charges" },
  { value: "Refund", label: "Refunds" },
];

// --- Disputes ----------------------------------------------------------------

export const DISPUTE_STATUS_MAP = {
  "Needs response": {
    label: "Needs response",
    variant: "warning",
    dotClass: "bg-amber-400",
  },
  "Under review": { label: "Under review", variant: "info", dotClass: "bg-sky-400" },
  Won: { label: "Won", variant: "success", dotClass: "bg-emerald-400" },
  Lost: { label: "Lost", variant: "danger", dotClass: "bg-red-400" },
};

export const DISPUTE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All disputes" },
  { value: "Needs response", label: "Needs response" },
  { value: "Under review", label: "Under review" },
  { value: "Won", label: "Won" },
  { value: "Lost", label: "Lost" },
];

// --- Order timeline ----------------------------------------------------------

export const ORDER_EVENT_LABELS = {
  created: "Order placed",
  refund_requested: "Refund requested",
  refund_issued: "Refund issued",
  cancelled: "Order cancelled",
  receipt_sent: "Receipt sent",
  invoice_generated: "Invoice generated",
  note: "Note",
  status_change: "Status changed",
  disputed: "Dispute opened",
};

// --- Order Settings defaults (ticketing_settings, module "orders") -----------

export const defaultOrderSettingsConfig = () => ({
  orderPrefix: "ORD",
  refundReasonCodes: REFUND_REASON_OPTIONS.map((r) => r.value),
  refundMethods: REFUND_METHOD_OPTIONS.map((m) => m.value),
  receiptFooter: "Thanks for your order! Reply to this email if you need a hand.",
  defaultRefundPolicy: "partial",
});
