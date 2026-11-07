"use client";

import { useEffect, useState } from "react";

export const RFP_STATUS_MAP = {
  draft: { label: "Draft", variant: "neutral", dotClass: "bg-[#737373]" },
  sent: { label: "Out for bids", variant: "info", dotClass: "bg-sky-400" },
  closed: { label: "Bidding closed", variant: "warning", dotClass: "bg-amber-400" },
  awarded: { label: "Awarded", variant: "success", dotClass: "bg-emerald-400" },
  cancelled: { label: "Cancelled", variant: "outline", dotClass: "bg-[#525252]" },
};

export const RECIPIENT_STATUS_MAP = {
  pending: { label: "Not sent", variant: "outline", dotClass: "bg-[#525252]" },
  invited: { label: "Invited", variant: "neutral", dotClass: "bg-[#737373]" },
  viewed: { label: "Viewed", variant: "info", dotClass: "bg-sky-400" },
  responded: { label: "Responded", variant: "purple", dotClass: "bg-violet-400" },
  declined: { label: "Declined", variant: "danger", dotClass: "bg-red-400" },
  awarded: { label: "Awarded", variant: "success", dotClass: "bg-emerald-400" },
  lost: { label: "Not selected", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const BID_STATUS_MAP = {
  submitted: { label: "Submitted", variant: "info", dotClass: "bg-sky-400" },
  shortlisted: { label: "Shortlisted", variant: "purple", dotClass: "bg-violet-400" },
  awarded: { label: "Awarded", variant: "success", dotClass: "bg-emerald-400" },
  rejected: { label: "Rejected", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const SOURCE_LABELS = { venue: "Venues book", pipeline: "Pipeline", manual: "Manual" };

export const RFP_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  ...Object.entries(RFP_STATUS_MAP).map(([value, m]) => ({ value, label: m.label })),
];

// A recipient that was added but never emailed shows as "Not sent".
export const recipientDisplayStatus = (r) => (r?.invitedAt ? r.status : "pending");

// Editable only before the brief goes out, so every venue prices the same thing.
export const isBriefLocked = (rfp) => rfp?.status !== "draft";
export const isFinal = (rfp) => rfp?.status === "awarded" || rfp?.status === "cancelled";

export function relativeTime(iso, now) {
  const t = Date.parse(iso || "");
  if (!Number.isFinite(t)) return "";
  const mins = Math.round((now - t) / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.round(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  return days < 30 ? `${days}d ago` : new Date(t).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// A clock that ticks every `intervalMs`, so countdowns stay live without reading Date.now() in render.
export function useNow(intervalMs = 60000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}
