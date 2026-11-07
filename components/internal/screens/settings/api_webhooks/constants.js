import { toast } from "sonner";

import { WEBHOOK_EVENT_TYPES, TEST_EVENT_TYPE } from "@/lib/api_webhooks/catalog";
import { formatDate, formatRelativeTime } from "../constants";

export { formatDate, formatRelativeTime };

export const DELIVERY_STATUS_MAP = {
  succeeded: { label: "Delivered", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Retrying", variant: "warning", dotClass: "bg-amber-400" },
  dead: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
  pending: { label: "Pending", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const DELIVERY_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "succeeded", label: "Delivered" },
  { value: "failed", label: "Retrying" },
  { value: "dead", label: "Failed" },
  { value: "pending", label: "Pending" },
];

export const KEY_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-[#737373]" },
  revoked: { label: "Revoked", variant: "outline", dotClass: "bg-[#525252]" },
};

export const ENDPOINT_STATUS_MAP = {
  enabled: { label: "Enabled", variant: "success", dotClass: "bg-emerald-400" },
  disabled: { label: "Disabled", variant: "neutral", dotClass: "bg-[#737373]" },
  auto_disabled: { label: "Turned off", variant: "danger", dotClass: "bg-red-400" },
};

export const ORIGIN_LABELS = { event: "Event", test: "Test", replay: "Replay" };

export function endpointState(endpoint) {
  if (endpoint?.active) return "enabled";
  return endpoint?.disabledReason ? "auto_disabled" : "disabled";
}

const TYPE_LABELS = Object.fromEntries(WEBHOOK_EVENT_TYPES.map((t) => [t.type, t.label]));

export function eventTypeLabel(type) {
  if (type === TEST_EVENT_TYPE) return "Test event";
  return TYPE_LABELS[type] || type;
}

export function eventTypesSummary(types) {
  if (!types?.length) return "No events";
  if (types.includes("*")) return "All events";
  if (types.length === 1) return eventTypeLabel(types[0]);
  return `${types.length} events`;
}

// "hooks.example.com/geiger" — the part of a URL people recognise.
export function hostPath(url) {
  try {
    const u = new URL(url);
    const path = u.pathname === "/" ? "" : u.pathname;
    return `${u.host}${path}`;
  } catch {
    return url || "";
  }
}

export function formatUntil(value) {
  if (!value) return "";
  const diff = new Date(value).getTime() - Date.now();
  if (Number.isNaN(diff)) return "";
  if (diff <= 30_000) return "any moment";
  const mins = Math.round(diff / 60000);
  if (mins < 60) return `in ${mins}m`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `in ${hours}h`;
  return `in ${Math.round(hours / 24)}d`;
}

export function formatDateTime(value) {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-GB", {
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  });
}

export function shortId(id) {
  return id ? String(id).slice(0, 8) : "";
}

export function successRate(health) {
  const settled = (health?.succeeded || 0) + (health?.dead || 0) + (health?.failed || 0);
  if (!settled) return null;
  return Math.round(((health.succeeded || 0) / settled) * 100);
}

export async function copyText(value, message = "Copied") {
  try {
    await navigator.clipboard.writeText(value);
    toast.success(message);
  } catch {
    toast.error("Couldn't copy that. Select the text and copy it yourself.");
  }
}

// One toast for a manual send's outcome (test, retry, replay).
export function toastSendResult(response, label) {
  if (response.error) {
    toast.error(response.error.message);
    return;
  }
  if (response.busy || !response.result) {
    toast(`${label}: it's being sent right now. Check the log in a moment.`);
    return;
  }
  const { outcome, status, ms, error } = response.result;
  if (outcome === "succeeded") toast.success(`${label} delivered: HTTP ${status} in ${ms} ms`);
  else toast.error(`${label} failed: ${error || `HTTP ${status}`}`);
}
