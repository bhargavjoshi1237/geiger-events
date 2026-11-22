import type { StatusMeta, Tone } from "@/lib/status";
import { colors } from "@/theme/tokens";
import type { DisputeStatus, EnquiryStatus, RefundRequestStatus } from "@/types/control_money";

// Labels and tones for the money screens, matching the dashboard's status pills.

export const REQUEST_STATUS: Record<RefundRequestStatus, StatusMeta> = {
  Requested: { label: "Requested", tone: "warning" },
  Approved: { label: "Approved", tone: "info" },
  Denied: { label: "Denied", tone: "danger" },
  Refunded: { label: "Refunded", tone: "success" },
};

export const DISPUTE_STATUS: Record<DisputeStatus, StatusMeta> = {
  "Needs response": { label: "Needs response", tone: "warning" },
  "Under review": { label: "Under review", tone: "info" },
  Won: { label: "Won", tone: "success" },
  Lost: { label: "Lost", tone: "danger" },
};

export const ENQUIRY_STATUS: Record<EnquiryStatus, StatusMeta> = {
  new: { label: "New", tone: "info" },
  contacted: { label: "Contacted", tone: "warning" },
  converted: { label: "Won", tone: "success" },
  declined: { label: "Declined", tone: "neutral" },
};

export const TONE_COLOR: Record<Tone, string> = {
  success: colors.success,
  danger: colors.danger,
  info: colors.info,
  warning: colors.warning,
  neutral: colors.mutedForeground,
};

export function metaOf<K extends string>(map: Record<K, StatusMeta>, status: string): StatusMeta {
  return map[status as K] ?? { label: status || "—", tone: "neutral" };
}
