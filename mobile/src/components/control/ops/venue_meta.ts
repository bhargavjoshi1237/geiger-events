import type { IconName } from "@/components/ui/icons";
import type { StatusMeta } from "@/lib/status";
import type { OpsVenue } from "@/types/control_ops";

export const VENUE_STATUS: Record<OpsVenue["status"], StatusMeta> = {
  Active: { label: "Active", tone: "success" },
  Inactive: { label: "Inactive", tone: "neutral" },
  Archived: { label: "Archived", tone: "neutral" },
};

export const VENUE_ICON: Record<OpsVenue["type"], IconName> = {
  Indoor: "building-2",
  Outdoor: "sun",
  Hybrid: "layers",
  Virtual: "monitor",
};

export function venueStatus(status: string): StatusMeta {
  return VENUE_STATUS[status as OpsVenue["status"]] ?? { label: status || "—", tone: "neutral" };
}
