import type { IconName } from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";
import type { StatusMeta } from "@/lib/status";
import type { ControlCapability, ControlEvent, ControlEventStatus, ControlGuestStatus, ControlOrderStatus } from "@/types/portal";

export const CAPABILITY_META: Record<ControlCapability, { icon: IconName; label: string; detail: string }> = {
  events: { icon: "calendar", label: "Events", detail: "See this project's events" },
  checkIn: { icon: "qr-code", label: "Check-in", detail: "Admit guests at the door" },
  guests: { icon: "users", label: "Guests", detail: "Look up attendees" },
  orders: { icon: "shopping-bag", label: "Orders", detail: "View orders" },
  analytics: { icon: "chart-column", label: "Analytics", detail: "Sales and attendance numbers" },
  workspace: { icon: "briefcase", label: "Workspace", detail: "Run the event workspace" },
  inbox: { icon: "inbox", label: "Inbox", detail: "Answer buyers and send announcements" },
  edit: { icon: "square-pen", label: "Edit events", detail: "Change details, tickets and guests" },
  publish: { icon: "globe", label: "Publish", detail: "Put events on sale or take them off" },
  delete: { icon: "trash-2", label: "Delete events", detail: "Remove events" },
  refund: { icon: "undo-2", label: "Refunds", detail: "Refund, cancel and correct orders" },
};

export const EVENT_STATUSES: ControlEventStatus[] = ["Draft", "Scheduled", "On Sale", "Sold out", "Ended"];

export const EVENT_STATUS_META: Record<ControlEventStatus, StatusMeta & { detail: string }> = {
  Draft: { label: "Draft", tone: "neutral", detail: "Only your team can see it" },
  Scheduled: { label: "Scheduled", tone: "info", detail: "Announced, not on sale yet" },
  "On Sale": { label: "On sale", tone: "success", detail: "Buyers can get tickets" },
  "Sold out": { label: "Sold out", tone: "warning", detail: "Shown as sold out" },
  Ended: { label: "Ended", tone: "neutral", detail: "Finished; sales are closed" },
};

export function eventStatusMeta(status: string): StatusMeta {
  return EVENT_STATUS_META[status as ControlEventStatus] ?? { label: status || "—", tone: "neutral" };
}

export const ORDER_STATUS_META: Record<ControlOrderStatus, StatusMeta> = {
  Paid: { label: "Paid", tone: "success" },
  "Partially refunded": { label: "Part refunded", tone: "warning" },
  Refunded: { label: "Refunded", tone: "info" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export const GUEST_STATUS_META: Record<ControlGuestStatus, StatusMeta> = {
  Confirmed: { label: "Confirmed", tone: "success" },
  Pending: { label: "Pending", tone: "warning" },
  Waitlisted: { label: "Waitlisted", tone: "info" },
  Declined: { label: "Declined", tone: "danger" },
  "Checked-in": { label: "Checked in", tone: "success" },
  Cancelled: { label: "Cancelled", tone: "danger" },
};

export function whenLabel(event: ControlEvent): string {
  if (event.when === "today") return event.time ? `Today · ${event.time.slice(0, 5)}` : "Today";
  if (event.when === "unscheduled") return "No date yet";
  return fmtDate(event.date);
}

// Amounts in the event's own currency; an unknown code falls back to a plain number rather than throwing.
export function moneyIn(amount: number, currency = "usd"): string {
  try {
    return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(amount || 0);
  } catch {
    return (amount || 0).toFixed(2);
  }
}

// "Sat, Dec 6 · 19:30" from the event's own calendar date (parsed as local, never via UTC midnight).
export function eventDateLine(event: Pick<ControlEvent, "date" | "time" | "when">): string {
  const time = event.time ? event.time.slice(0, 5) : "";
  if (event.when === "today") return ["Today", time].filter(Boolean).join(" · ");
  const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(event.date ?? "");
  if (!m) return "No date yet";
  const day = new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  const label = day.toLocaleDateString("en-US", { weekday: "short", month: "short", day: "numeric", year: day.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
  return [label, time].filter(Boolean).join(" · ");
}

// The day of the month, zero-padded, for the faint numeral behind an event header.
export function eventDayNumeral(date: string | null): string | null {
  const m = /^\d{4}-\d{2}-(\d{2})/.exec(date ?? "");
  return m ? m[1] : null;
}
