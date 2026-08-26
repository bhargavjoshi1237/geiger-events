
export type Tone = "success" | "danger" | "info" | "warning" | "neutral";

export type StatusMeta = { label: string; tone: Tone };

export const ORDER_STATUS: Record<string, StatusMeta> = {
  confirmed: { label: "Confirmed", tone: "success" },
  cancelled: { label: "Cancelled", tone: "danger" },
  refunded: { label: "Refunded", tone: "info" },
};

export const REFUND_STATUS: Record<string, StatusMeta> = {
  Requested: { label: "Refund requested", tone: "warning" },
  Approved: { label: "Refund approved", tone: "success" },
  Denied: { label: "Refund denied", tone: "danger" },
  Refunded: { label: "Refunded", tone: "info" },
};

export const MEMBER_STATUS: Record<string, StatusMeta> = {
  Active: { label: "Active", tone: "success" },
  Expired: { label: "Expired", tone: "warning" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export const THREAD_STATUS: Record<string, StatusMeta> = {
  open: { label: "Open", tone: "info" },
  closed: { label: "Closed", tone: "neutral" },
};

export function statusPill(
  map: Record<string, StatusMeta>,
  status: string | null | undefined,
): StatusMeta {
  return map[status || ""] || { label: status || "—", tone: "neutral" };
}
