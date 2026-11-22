import { EVENT_OFFSET_OPTIONS, PUSH_CATEGORIES, PUSH_TYPES, pushType } from "@/lib/push/types";
import { formatRelativeTime } from "../constants";
import { formatDateTime, formatUntil } from "../api_webhooks/constants";

export { formatDateTime, formatRelativeTime, formatUntil };

export const MAX_TIMINGS = 4;

export const PUSH_STATUS_MAP = {
  queued: { label: "Queued", variant: "neutral", dotClass: "bg-[#737373]" },
  sending: { label: "Sending", variant: "info", dotClass: "bg-sky-400" },
  sent: { label: "Sent", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
  skipped: { label: "Skipped", variant: "outline", dotClass: "bg-[#525252]" },
};

export const PUSH_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "queued", label: "Queued" },
  { value: "sending", label: "Sending" },
  { value: "sent", label: "Sent" },
  { value: "failed", label: "Failed" },
  { value: "skipped", label: "Skipped" },
];

export const PUSH_TYPE_FILTER_OPTIONS = [
  { value: "all", label: "All types" },
  ...PUSH_TYPES.map((t) => ({ value: t.key, label: t.label })),
];

export const SKIP_REASON_LABELS = {
  muted: "Member turned this category off",
  type_off: "Type switched off for this project",
  paused: "Push paused",
  expired: "Too late to send",
  superseded: "Replaced by a newer update",
  no_member: "Recipient has no app account",
  covered: "Covered by an order confirmation",
  no_device: "No device registered",
  render: "Source record no longer exists",
};

export function skipReasonLabel(reason) {
  return SKIP_REASON_LABELS[reason] || reason || "Skipped";
}

// Failed and skipped rows can be sent again from the log.
export function canRetry(item) {
  return item?.status === "failed" || item?.status === "skipped";
}

const CATEGORY_LABELS = Object.fromEntries(PUSH_CATEGORIES.map((c) => [c.key, c.label]));

export function categoryLabel(key) {
  return CATEGORY_LABELS[key] || key || "";
}

export function typeLabel(type) {
  if (type === "test") return "Test push";
  return pushType(type)?.label || type || "Push";
}

// Ticket = Expo accepted the message; receipt = Apple or Google confirmed the hand-off.
export const TICKET_STATUS_MAP = {
  ok: { label: "Accepted", variant: "success", dotClass: "bg-emerald-400" },
  error: { label: "Rejected", variant: "danger", dotClass: "bg-red-400" },
};

export const RECEIPT_STATUS_MAP = {
  pending: { label: "Receipt pending", variant: "neutral", dotClass: "bg-[#737373]" },
  ok: { label: "Delivered", variant: "success", dotClass: "bg-emerald-400" },
  error: { label: "Receipt error", variant: "danger", dotClass: "bg-red-400" },
};

const PLATFORM_LABELS = { ios: "iOS", android: "Android", web: "Web" };

export function platformLabel(platform) {
  return PLATFORM_LABELS[String(platform || "").toLowerCase()] || platform || "Device";
}

const OFFSET_LABELS = Object.fromEntries(EVENT_OFFSET_OPTIONS.map((o) => [o.value, o.label]));

export function offsetLabel(minutes) {
  if (OFFSET_LABELS[minutes]) return OFFSET_LABELS[minutes];
  if (minutes % 1440 === 0) return `${minutes / 1440} days before`;
  if (minutes % 60 === 0) return `${minutes / 60} hours before`;
  return `${minutes} minutes before`;
}

export function dayLabel(days) {
  return days === 1 ? "1 day before" : `${days} days before`;
}

// "1 day before and 1 hour before" for a row's description.
export function listLabel(labels) {
  if (!labels.length) return "";
  if (labels.length === 1) return labels[0];
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}

export const JOB_LABELS = {
  "events-push-dispatch": { label: "Dispatcher", description: "Sends pushes that are due and checks delivery receipts." },
  "events-push-plan": { label: "Planner", description: "Plans reminders and releases scheduled announcements." },
};

const SCHEDULE_LABELS = {
  "30 seconds": "Every 30 seconds",
  "*/5 * * * *": "Every 5 minutes",
};

export function scheduleLabel(schedule) {
  return SCHEDULE_LABELS[schedule] || schedule || "—";
}

// pg_cron run states, folded into what an organiser needs to know.
export const JOB_RUN_STATUS_MAP = {
  succeeded: { label: "Succeeded", variant: "success", dotClass: "bg-emerald-400" },
  failed: { label: "Failed", variant: "danger", dotClass: "bg-red-400" },
  running: { label: "Running", variant: "info", dotClass: "bg-sky-400" },
  starting: { label: "Running", variant: "info", dotClass: "bg-sky-400" },
  sending: { label: "Running", variant: "info", dotClass: "bg-sky-400" },
  connecting: { label: "Running", variant: "info", dotClass: "bg-sky-400" },
};

export const JOB_ACTIVE_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  inactive: { label: "Off", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const RUN_KIND_LABELS = { dispatch: "Dispatch", plan: "Plan" };

export function formatDuration(ms) {
  if (ms === null || ms === undefined || Number.isNaN(Number(ms))) return "—";
  const value = Number(ms);
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(value < 10_000 ? 1 : 0)} s`;
}
