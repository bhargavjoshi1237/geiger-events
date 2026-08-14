// Status -> Pill mappings, ported from the web's screen_kit StatusPill maps.

export type Tone = "success" | "danger" | "info" | "warning" | "neutral";

export type StatusMeta = { label: string; tone: Tone };

// Order payment statuses (lowercase, as the API returns them).
export const ORDER_STATUS: Record<string, StatusMeta> = {
  confirmed: { label: "Confirmed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  refunded: { label: "Refunded", tone: "info" },
};

// Per-order refund request statuses (capitalized).
export const REFUND_STATUS: Record<string, StatusMeta> = {
  Requested: { label: "Refund requested", tone: "warning" },
  Approved: { label: "Refund approved", tone: "success" },
  Denied: { label: "Refund denied", tone: "danger" },
  Refunded: { label: "Refunded", tone: "info" },
};

// Membership statuses (capitalized).
export const MEMBER_STATUS: Record<string, StatusMeta> = {
  Active: { label: "Active", tone: "success" },
  Expired: { label: "Expired", tone: "warning" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

// Support-thread statuses (lowercase, as the API returns them).
export const THREAD_STATUS: Record<string, StatusMeta> = {
  open: { label: "Open", tone: "info" },
  closed: { label: "Closed", tone: "neutral" },
};

// Resolve any status to a Pill meta, falling back to a neutral label.
export function statusPill(
  map: Record<string, StatusMeta>,
  status: string | null | undefined,
): StatusMeta {
  return map[status || ""] || { label: status || "—", tone: "neutral" };
}
