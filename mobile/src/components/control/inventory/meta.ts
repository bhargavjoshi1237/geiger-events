import type { StatusMeta } from "@/lib/status";
import type { AllocationStatus, MemberStatus, MovementKind, PurchaseOrderStatus, StockStatus } from "@/types/control_inventory";

// Labels and tones for Control's Inventory and Members screens, matching the dashboard's status maps.

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

export const STOCK_META: Record<StockStatus, StatusMeta> = {
  "In stock": { label: "In stock", tone: "success" },
  "Low stock": { label: "Low stock", tone: "warning" },
  "Out of stock": { label: "Out of stock", tone: "danger" },
};

export const MOVEMENT_META: Record<MovementKind, StatusMeta> = {
  receive: { label: "Received", tone: "success" },
  adjust: { label: "Adjusted", tone: "info" },
  issue: { label: "Issued", tone: "warning" },
  return: { label: "Returned", tone: "success" },
  waste: { label: "Wasted", tone: "danger" },
  transfer: { label: "Transferred", tone: "neutral" },
};

export const ALLOCATION_META: Record<AllocationStatus, StatusMeta> = {
  Planned: { label: "Planned", tone: "neutral" },
  Reserved: { label: "Reserved", tone: "info" },
  Issued: { label: "Issued", tone: "success" },
  Closed: { label: "Closed", tone: "neutral" },
};

export const ISSUANCE_LABEL: Record<string, string> = {
  internal: "Internal",
  ticket: "Ticket-based",
  addon: "Add-on",
  session: "Session-based",
  all: "Every attendee",
  audience: "Targeted audience",
};

export const PO_META: Record<PurchaseOrderStatus, StatusMeta> = {
  Draft: { label: "Draft", tone: "neutral" },
  Ordered: { label: "Ordered", tone: "info" },
  Partial: { label: "Part received", tone: "warning" },
  Received: { label: "Received", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export const MEMBER_META: Record<MemberStatus, StatusMeta> = {
  Active: { label: "Active", tone: "success" },
  Expired: { label: "Expired", tone: "warning" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

// Stock is numeric(14,2) but almost always whole units.
export function qtyText(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(2);
}

export function signedQty(n: number): string {
  return `${n > 0 ? "+" : ""}${qtyText(n)}`;
}

// A typed quantity, or null when it isn't a number yet.
export function parseQty(text: string): number | null {
  const trimmed = text.trim().replace(",", ".");
  if (!trimmed) return null;
  const n = Number(trimmed);
  return Number.isFinite(n) ? n : null;
}

// Mirrors the server's MOVEMENT_KINDS: direction fixes the sign, "either" lets the organiser choose.
export const MOVEMENT_KINDS: { value: MovementKind; label: string; direction: "in" | "out" | "either" }[] = [
  { value: "receive", label: "Receive", direction: "in" },
  { value: "adjust", label: "Adjust", direction: "either" },
  { value: "issue", label: "Issue out", direction: "out" },
  { value: "return", label: "Return", direction: "in" },
  { value: "waste", label: "Write off", direction: "out" },
  { value: "transfer", label: "Transfer out", direction: "out" },
];
