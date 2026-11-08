import type { IconName } from "@/components/ui/icons";
import { fmtDate } from "@/lib/format";
import type { ControlCapability, ControlEvent } from "@/types/portal";

export const CAPABILITY_META: Record<ControlCapability, { icon: IconName; label: string; detail: string }> = {
  events: { icon: "calendar", label: "Events", detail: "See this project's events" },
  checkIn: { icon: "qr-code", label: "Check-in", detail: "Admit guests at the door" },
  guests: { icon: "users", label: "Guests", detail: "Look up attendees" },
  orders: { icon: "shopping-bag", label: "Orders", detail: "View orders and refunds" },
  analytics: { icon: "chart-column", label: "Analytics", detail: "Sales and attendance numbers" },
  operations: { icon: "briefcase", label: "Operations", detail: "Run the event workspace" },
};

export function whenLabel(event: ControlEvent): string {
  if (event.when === "today") return event.time ? `Today · ${event.time}` : "Today";
  if (event.when === "unscheduled") return "No date yet";
  return fmtDate(event.date);
}
