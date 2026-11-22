import type { StatusMeta } from "@/lib/status";
import type { BookingDisplayStatus, RfpBidStatus, RfpRecipient, RfpStatus } from "@/types/control_sourcing";

// The dashboard's Sourcing status maps, as app tones.

export const RFP_STATUS: Record<RfpStatus, StatusMeta> = {
  draft: { label: "Draft", tone: "neutral" },
  sent: { label: "Out for bids", tone: "info" },
  closed: { label: "Bidding closed", tone: "warning" },
  awarded: { label: "Awarded", tone: "success" },
  cancelled: { label: "Cancelled", tone: "neutral" },
};

export const RECIPIENT_STATUS: Record<RfpRecipient["status"], StatusMeta> = {
  pending: { label: "Not sent", tone: "neutral" },
  invited: { label: "Invited", tone: "neutral" },
  viewed: { label: "Viewed", tone: "info" },
  responded: { label: "Responded", tone: "info" },
  declined: { label: "Declined", tone: "danger" },
  awarded: { label: "Awarded", tone: "success" },
  lost: { label: "Not selected", tone: "neutral" },
};

export const BID_STATUS: Record<RfpBidStatus, StatusMeta> = {
  submitted: { label: "Submitted", tone: "info" },
  shortlisted: { label: "Shortlisted", tone: "warning" },
  awarded: { label: "Awarded", tone: "success" },
  rejected: { label: "Rejected", tone: "neutral" },
};

export const BOOKING_STATUS: Record<BookingDisplayStatus, StatusMeta> = {
  Confirmed: { label: "Confirmed", tone: "success" },
  Hold: { label: "Hold", tone: "warning" },
  "Hold expired": { label: "Hold expired", tone: "neutral" },
  Completed: { label: "Completed", tone: "neutral" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export const RFP_FILTERS = [
  { value: "all", label: "All" },
  { value: "draft", label: "Drafts" },
  { value: "sent", label: "Out for bids" },
  { value: "closed", label: "Closed" },
  { value: "awarded", label: "Awarded" },
  { value: "cancelled", label: "Cancelled" },
];

export const BOOKING_FILTERS = [
  { value: "upcoming", label: "Upcoming" },
  { value: "Hold", label: "Holds" },
  { value: "Confirmed", label: "Confirmed" },
  { value: "Hold expired", label: "Expired holds" },
  { value: "Completed", label: "Completed" },
  { value: "Cancelled", label: "Cancelled" },
  { value: "all", label: "All" },
];

// RFP amounts carry their own ISO code (USD, GBP…); an unknown code falls back to a plain number.
export function money(amount: number | null | undefined, currency = "USD"): string {
  if (amount == null) return "—";
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency, maximumFractionDigits: 0 }).format(amount);
  } catch {
    return String(Math.round(amount));
  }
}

// "3d left", "Due today", "Closed 2d ago" — the dashboard's deadline chip in words.
export function deadlineLabel(deadline: string | null, now = Date.now()): string {
  const at = deadline ? Date.parse(deadline) : NaN;
  if (!Number.isFinite(at)) return "No deadline";
  const days = Math.round((at - now) / 86_400_000);
  if (at < now) return days === 0 ? "Deadline passed today" : `Deadline passed ${Math.abs(days)}d ago`;
  if (days === 0) return "Due today";
  return `${days}d left`;
}
