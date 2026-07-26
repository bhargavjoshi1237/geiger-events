// Lookups, option lists, and formatters for the Inventory area.
// Config only — never row data.

import {
  BadgeCheck,
  Gift,
  Package,
  Printer,
  Shirt,
  UtensilsCrossed,
  Wrench,
} from "lucide-react";

// --- Formatters --------------------------------------------------------------

export const currency = (n) => {
  const v = Number(n || 0);
  const sign = v < 0 ? "-" : "";
  return `${sign}$${Math.abs(v).toLocaleString(undefined, {
    minimumFractionDigits: Number.isInteger(v) ? 0 : 2,
    maximumFractionDigits: 2,
  })}`;
};

// Stock quantities are numeric(14,2) but almost always whole units.
export const qty = (n) => {
  const v = Number(n || 0);
  return Number.isInteger(v) ? String(v) : v.toFixed(2);
};

// Signed quantity for the ledger, so "+12" reads differently from "-12".
export const signedQty = (n) => {
  const v = Number(n || 0);
  return `${v > 0 ? "+" : ""}${qty(v)}`;
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

// A short, human PO reference derived from the UUID when no code was typed.
export const poRef = (po) =>
  po?.code ||
  (po?.id ? `PO-${String(po.id).replace(/-/g, "").slice(0, 6).toUpperCase()}` : "—");

// The label a row shows: "Tee" for a parent, "Tee — Large" for a variant.
export const itemLabel = (item) =>
  item?.variantLabel ? `${item.name} — ${item.variantLabel}` : item?.name || "Untitled item";

// --- Categories --------------------------------------------------------------

export const ITEM_CATEGORIES = [
  "Merch",
  "Swag",
  "Badges & Credentials",
  "Print & Signage",
  "Food & Beverage",
  "Equipment",
  "Supplies",
  "Other",
];

// Shape of the placeholder shown when an item has no photo yet, so a catalog
// with no uploads still reads at a glance.
export const CATEGORY_ICONS = {
  Merch: Shirt,
  Swag: Gift,
  "Badges & Credentials": BadgeCheck,
  "Print & Signage": Printer,
  "Food & Beverage": UtensilsCrossed,
  Equipment: Wrench,
  Supplies: Package,
  Other: Package,
};

export const CATEGORY_FILTER_OPTIONS = [
  { value: "all", label: "All categories" },
  ...ITEM_CATEGORIES.map((c) => ({ value: c, label: c })),
];

// --- Stock status (derived from on-hand vs reorder point) --------------------

export const STOCK_STATUS_MAP = {
  "In stock": { label: "In stock", variant: "success", dotClass: "bg-emerald-400" },
  "Low stock": { label: "Low stock", variant: "warning", dotClass: "bg-amber-400" },
  "Out of stock": { label: "Out of stock", variant: "danger", dotClass: "bg-red-400" },
};

export const STOCK_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All stock levels" },
  { value: "In stock", label: "In stock" },
  { value: "Low stock", label: "Low stock" },
  { value: "Out of stock", label: "Out of stock" },
];

// On-hand vs the item's reorder point. A reorder point of 0 disables the
// low-stock band, so anything above zero simply reads as "In stock".
export const stockStatus = (onHand, reorderPoint) => {
  const n = Number(onHand || 0);
  if (n <= 0) return "Out of stock";
  if (Number(reorderPoint || 0) > 0 && n <= Number(reorderPoint)) return "Low stock";
  return "In stock";
};

// --- Issuance ----------------------------------------------------------------

export const ISSUANCE_MAP = {
  internal: {
    label: "Internal",
    variant: "neutral",
    dotClass: "bg-zinc-400",
    hint: "Management-only stock. Demand is whatever you plan.",
  },
  ticket: {
    label: "Ticket-based",
    variant: "info",
    dotClass: "bg-sky-400",
    hint: "Issued to every buyer holding the selected tickets.",
  },
  addon: {
    label: "Add-on",
    variant: "success",
    dotClass: "bg-emerald-400",
    hint: "Backs a paid add-on; demand follows add-on sales.",
  },
  session: {
    label: "Session-based",
    variant: "info",
    dotClass: "bg-violet-400",
    hint: "Issued to attendees signed up for the selected sessions.",
  },
  all: {
    label: "Every attendee",
    variant: "info",
    dotClass: "bg-sky-400",
    hint: "Anyone with a live order or registration for the event.",
  },
  audience: {
    label: "Targeted audience",
    variant: "info",
    dotClass: "bg-amber-400",
    hint: "Issued to a saved audience — tickets, add-ons or named buyers.",
  },
};

export const ISSUANCE_OPTIONS = [
  { value: "internal", label: "Internal" },
  { value: "ticket", label: "Ticket-based" },
  { value: "addon", label: "Add-on" },
  { value: "session", label: "Session-based" },
  { value: "all", label: "Every attendee" },
  { value: "audience", label: "Targeted audience" },
];

// Modes that hand stock to a buyer, so they need a collection rule and appear
// at the issuing desk. `internal` stock is only ever issued walk-up.
export const BUYER_ISSUANCE_MODES = ["ticket", "addon", "session", "all", "audience"];

export const ISSUANCE_FILTER_OPTIONS = [
  { value: "all", label: "All issuance" },
  ...ISSUANCE_OPTIONS,
];

export const issuanceLabel = (value) => ISSUANCE_MAP[value]?.label || "Internal";

// --- Allocation status -------------------------------------------------------

export const ALLOCATION_STATUS_MAP = {
  Planned: { label: "Planned", variant: "neutral", dotClass: "bg-zinc-400" },
  Reserved: { label: "Reserved", variant: "info", dotClass: "bg-sky-400" },
  Issued: { label: "Issued", variant: "success", dotClass: "bg-emerald-400" },
  Closed: { label: "Closed", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const ALLOCATION_STATUS_OPTIONS = [
  { value: "Planned", label: "Planned" },
  { value: "Reserved", label: "Reserved" },
  { value: "Issued", label: "Issued" },
  { value: "Closed", label: "Closed" },
];

export const ALLOCATION_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  ...ALLOCATION_STATUS_OPTIONS,
];

// Allocations still holding stock against the catalog. A partially-issued
// allocation still reserves its remainder, so only Closed drops out — the
// outstanding figure (planned - issued) is zero for a fully issued one anyway.
export const OPEN_ALLOCATION_STATUSES = ["Planned", "Reserved", "Issued"];

// --- Movements ---------------------------------------------------------------

export const MOVEMENT_KIND_MAP = {
  receive: { label: "Received", variant: "success", dotClass: "bg-emerald-400" },
  adjust: { label: "Adjusted", variant: "info", dotClass: "bg-sky-400" },
  issue: { label: "Issued", variant: "warning", dotClass: "bg-amber-400" },
  return: { label: "Returned", variant: "success", dotClass: "bg-emerald-400" },
  waste: { label: "Wasted", variant: "danger", dotClass: "bg-red-400" },
  transfer: { label: "Transferred", variant: "neutral", dotClass: "bg-zinc-400" },
};

// `direction` fixes the sign the dialog applies; "either" lets the user choose.
export const MOVEMENT_KIND_OPTIONS = [
  { value: "receive", label: "Receive into stock", direction: "in" },
  { value: "adjust", label: "Adjust count", direction: "either" },
  { value: "issue", label: "Issue out", direction: "out" },
  { value: "return", label: "Return to stock", direction: "in" },
  { value: "waste", label: "Write off / waste", direction: "out" },
  { value: "transfer", label: "Transfer out", direction: "out" },
];

export const MOVEMENT_KIND_FILTER_OPTIONS = [
  { value: "all", label: "All movements" },
  ...MOVEMENT_KIND_OPTIONS.map((k) => ({ value: k.value, label: k.label })),
];

export const movementDirection = (kind) =>
  MOVEMENT_KIND_OPTIONS.find((k) => k.value === kind)?.direction || "either";

export const movementLabel = (kind) => MOVEMENT_KIND_MAP[kind]?.label || "Adjusted";

// --- Purchase orders ---------------------------------------------------------

export const PO_STATUS_MAP = {
  Draft: { label: "Draft", variant: "neutral", dotClass: "bg-zinc-400" },
  Ordered: { label: "Ordered", variant: "info", dotClass: "bg-sky-400" },
  Partial: { label: "Partially received", variant: "warning", dotClass: "bg-amber-400" },
  Received: { label: "Received", variant: "success", dotClass: "bg-emerald-400" },
  Cancelled: { label: "Cancelled", variant: "danger", dotClass: "bg-red-400" },
};

export const PO_STATUS_OPTIONS = [
  { value: "Draft", label: "Draft" },
  { value: "Ordered", label: "Ordered" },
  { value: "Partial", label: "Partially received" },
  { value: "Received", label: "Received" },
  { value: "Cancelled", label: "Cancelled" },
];

export const PO_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All purchase orders" },
  ...PO_STATUS_OPTIONS,
];

// --- Create-dialog defaults --------------------------------------------------

export const EMPTY_ITEM_DRAFT = {
  name: "",
  sku: "",
  category: "Merch",
  description: "",
  unitCost: "",
  unitPrice: "",
  reorderPoint: "",
  openingStock: "",
  // Local File until the row exists; uploaded to inventory/<id>/ on save.
  imageFile: null,
};

export const EMPTY_VARIANT_DRAFT = {
  variantLabel: "",
  sku: "",
  unitCost: "",
  unitPrice: "",
  reorderPoint: "",
  openingStock: "",
  imageFile: null,
};

export const EMPTY_SUPPLIER_DRAFT = {
  name: "",
  contactName: "",
  email: "",
  phone: "",
  website: "",
  leadTimeDays: "",
  notes: "",
};
