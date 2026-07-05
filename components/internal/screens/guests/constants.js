// Lookups & formatters for the Guests area. Config, not data — never put
// fetched rows here. Mirrors the Events / Registrations constants conventions so
// the areas read alike.

import { Mail, MessageSquare, Phone, StickyNote, Settings2 } from "lucide-react";

// Contact CRM lifecycle -> { label, variant, dotClass } for StatusPill / Badge.
export const CONTACT_STATUS_MAP = {
  Lead: { label: "Lead", variant: "warning", dotClass: "bg-amber-400" },
  Active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  VIP: { label: "VIP", variant: "purple", dotClass: "bg-violet-300" },
  Archived: { label: "Archived", variant: "outline", dotClass: "bg-[#525252]" },
};

export const CONTACT_STATUS_VALUES = ["Lead", "Active", "VIP", "Archived"];

export const STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "Lead", label: "Lead" },
  { value: "Active", label: "Active" },
  { value: "VIP", label: "VIP" },
  { value: "Archived", label: "Archived" },
];

export const CONSENT_FILTER_OPTIONS = [
  { value: "all", label: "Any consent" },
  { value: "email", label: "Email opted-in" },
  { value: "sms", label: "SMS opted-in" },
  { value: "none", label: "No consent" },
];

// Blocklist folds into the contact book as a filter over the `blocked` flag.
export const BLOCK_FILTER_OPTIONS = [
  { value: "all", label: "Everyone" },
  { value: "active", label: "Not blocked" },
  { value: "blocked", label: "Blocked only" },
];

// Guest List latest-status pills (derived from registrations).
export const GUEST_STATUS_MAP = {
  Confirmed: { label: "Confirmed", variant: "success", dotClass: "bg-emerald-400" },
  "Checked-in": { label: "Checked-in", variant: "info", dotClass: "bg-sky-400" },
  Pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  Waitlisted: { label: "Waitlisted", variant: "purple", dotClass: "bg-violet-300" },
  Declined: { label: "Declined", variant: "outline", dotClass: "bg-[#525252]" },
  Cancelled: { label: "Cancelled", variant: "outline", dotClass: "bg-[#525252]" },
};

// GDPR request type + status.
export const DATA_REQUEST_TYPE_MAP = {
  Export: { label: "Export", variant: "info" },
  Erasure: { label: "Erasure", variant: "warning" },
  Rectification: { label: "Rectification", variant: "purple" },
};

export const DATA_REQUEST_TYPE_VALUES = ["Export", "Erasure", "Rectification"];

export const DATA_REQUEST_STATUS_MAP = {
  New: { label: "New", variant: "neutral", dotClass: "bg-[#737373]" },
  "In Progress": { label: "In Progress", variant: "warning", dotClass: "bg-amber-400" },
  Completed: { label: "Completed", variant: "success", dotClass: "bg-emerald-400" },
  Rejected: { label: "Rejected", variant: "outline", dotClass: "bg-[#525252]" },
};

export const DATA_REQUEST_STATUS_VALUES = [
  "New",
  "In Progress",
  "Completed",
  "Rejected",
];

export const DATA_REQUEST_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All requests" },
  { value: "New", label: "New" },
  { value: "In Progress", label: "In Progress" },
  { value: "Completed", label: "Completed" },
  { value: "Rejected", label: "Rejected" },
];

// Communication-history channel -> icon + tint.
export const ACTIVITY_CHANNEL_MAP = {
  Email: { label: "Email", icon: Mail, tint: "text-sky-400" },
  SMS: { label: "SMS", icon: MessageSquare, tint: "text-emerald-400" },
  Call: { label: "Call", icon: Phone, tint: "text-violet-300" },
  Note: { label: "Note", icon: StickyNote, tint: "text-amber-400" },
  System: { label: "System", icon: Settings2, tint: "text-text-tertiary" },
};

export const ACTIVITY_CHANNEL_VALUES = ["Note", "Email", "SMS", "Call", "System"];

// Segment rule-builder field catalog. `ops` are the operators offered; `input`
// tells the builder which value control to render.
export const SEGMENT_RULE_FIELDS = [
  {
    value: "status",
    label: "Status",
    ops: ["is", "isNot"],
    input: "status",
  },
  { value: "tag", label: "Tag", ops: ["is", "isNot"], input: "text" },
  { value: "attending", label: "Attending an event", ops: ["is"], input: "bool" },
  { value: "event", label: "Attending event", ops: ["is"], input: "event" },
  { value: "consentEmail", label: "Email consent", ops: ["is"], input: "bool" },
  { value: "consentSms", label: "SMS consent", ops: ["is"], input: "bool" },
  { value: "blocked", label: "Blocked", ops: ["is"], input: "bool" },
  { value: "company", label: "Company", ops: ["is"], input: "text" },
  { value: "location", label: "Location", ops: ["is"], input: "text" },
];

export const SEGMENT_OP_LABELS = {
  is: "is",
  isNot: "is not",
};

// Segment pill colors -> tailwind classes (/10 bg + /20 border), semantic tints.
export const SEGMENT_COLOR_MAP = {
  slate: "border-border bg-surface-card text-muted-foreground",
  emerald: "border-emerald-500/20 bg-emerald-500/10 text-emerald-400",
  sky: "border-sky-500/20 bg-sky-500/10 text-sky-400",
  amber: "border-amber-500/20 bg-amber-500/10 text-amber-400",
  violet: "border-violet-500/20 bg-violet-500/10 text-violet-300",
  rose: "border-rose-500/20 bg-rose-500/10 text-rose-300",
};

export const SEGMENT_COLOR_OPTIONS = [
  { value: "slate", label: "Slate" },
  { value: "emerald", label: "Emerald" },
  { value: "sky", label: "Sky" },
  { value: "amber", label: "Amber" },
  { value: "violet", label: "Violet" },
  { value: "rose", label: "Rose" },
];

// "2026-06-18" / ISO datetime -> "Jun 18, 2026". Mirrors the other areas.
export function formatDate(iso) {
  if (!iso) return "—";
  const [y, m, d] = String(iso).split("T")[0].split("-").map(Number);
  if (!y || !m || !d) return "—";
  const months = [
    "Jan", "Feb", "Mar", "Apr", "May", "Jun",
    "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
  ];
  return `${months[m - 1]} ${d}, ${y}`;
}

export function formatDateTime(iso) {
  if (!iso) return "—";
  return formatDate(String(iso).split("T")[0]);
}

// Local "today" as an ISO date (YYYY-MM-DD). Event dates are stored as plain
// dates, so lexicographic compare on YYYY-MM-DD is a valid chronological compare.
export function todayISO() {
  const d = new Date();
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// `days` from today as an ISO date (negative = past).
export function addDaysISO(days) {
  const d = new Date();
  d.setDate(d.getDate() + days);
  const p = (n) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// Who's Going time-window filter.
export const UPCOMING_WINDOW_OPTIONS = [
  { value: "all", label: "All upcoming" },
  { value: "today", label: "Today" },
  { value: "week", label: "Next 7 days" },
  { value: "month", label: "Next 30 days" },
];

// Attendee Export scope selector.
export const EXPORT_SCOPE_OPTIONS = [
  { value: "all", label: "All attendees" },
  { value: "today", label: "Today's events" },
  { value: "upcoming", label: "Upcoming events" },
  { value: "past", label: "Past events" },
  { value: "event", label: "Specific event" },
  { value: "location", label: "By venue / location" },
  { value: "status", label: "By status" },
  { value: "range", label: "Date range" },
];

// Two-initial avatar seed from a name (falls back to the email local part).
export function initials(name, email) {
  const src = String(name || "").trim() || String(email || "").split("@")[0];
  return String(src || "")
    .split(/[\s._-]+/)
    .filter(Boolean)
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}
