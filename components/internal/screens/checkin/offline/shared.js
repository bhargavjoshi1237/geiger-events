// Lookups and formatters shared by the Offline Check-in tabs.

import { portalUrl } from "@/lib/portal/portal_fetch";
import { shortDeviceId } from "@/lib/checkin/offline/device";

export const ROUTE_LABELS = { checkin: "Scanner", door: "Door sales", kiosk: "Kiosk" };

// A device counts as online if it was heard from in the last 2 minutes; heartbeats come every 30 seconds.
export const ONLINE_MS = 2 * 60 * 1000;
export const IDLE_MS = 30 * 60 * 1000;
export const STALE_MS = 5 * 60 * 1000;

export const DEVICE_STATUS_MAP = {
  online: { label: "Online", variant: "success", dotClass: "bg-emerald-400" },
  idle: { label: "Idle", variant: "neutral", dotClass: "bg-zinc-400" },
  unsynced: { label: "Unsynced scans", variant: "warning", dotClass: "bg-amber-400" },
  gone: { label: "Not seen", variant: "neutral", dotClass: "bg-zinc-500" },
};

// unsynced: holding queued scans and not heard from recently — the one to walk over to.
export function deviceStatus(device, now) {
  const seen = device.lastSeenAt ? new Date(device.lastSeenAt).getTime() : 0;
  const age = now - seen;
  if (device.queuedCount > 0 && age > STALE_MS) return "unsynced";
  if (age <= ONLINE_MS) return "online";
  if (age <= IDLE_MS) return "idle";
  return "gone";
}

export const CONFLICT_KIND_MAP = {
  duplicate: { label: "Entered twice", variant: "warning", dotClass: "bg-amber-400" },
  reentry: { label: "Re-entry refused", variant: "warning", dotClass: "bg-amber-400" },
  over_capacity: { label: "Over capacity", variant: "danger", dotClass: "bg-red-400" },
  invalid_ticket: { label: "Invalid ticket", variant: "danger", dotClass: "bg-red-400" },
};

export const CONFLICT_STATUS_MAP = {
  open: { label: "Open", variant: "warning", dotClass: "bg-amber-400" },
  resolved: { label: "Resolved", variant: "success", dotClass: "bg-emerald-400" },
};

export const CONFLICT_FILTER_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "resolved", label: "Resolved" },
  { value: "all", label: "All conflicts" },
];

export const RESOLUTION_LABELS = { keep_first: "Kept first admission", reviewed: "Reviewed" };

export function relativeTime(iso, now) {
  if (!iso) return "Never";
  const t = new Date(iso).getTime();
  if (!Number.isFinite(t)) return "Never";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 45) return "Just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  return new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

export function clockTime(iso) {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

// deviceId → "North gate iPad" (dashboard label), else the browser summary, else its short id.
export function deviceName(devicesById, deviceId) {
  if (!deviceId) return "Online scanner";
  const d = devicesById.get(deviceId);
  return d?.label || (d?.userAgent ? `${d.userAgent} · ${shortDeviceId(deviceId)}` : `Device ${shortDeviceId(deviceId)}`);
}

export function staffRouteUrl(route, eventId) {
  if (!eventId || typeof window === "undefined") return "";
  return `${window.location.origin}${portalUrl(`/${route}/${eventId}`)}`;
}
