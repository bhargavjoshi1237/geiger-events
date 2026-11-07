// Lookups and formatters for the Smart Badges screen. Config only — never row data.

export const BADGE_STATUS_MAP = {
  active: { label: "Active", variant: "success", dotClass: "bg-emerald-400" },
  unassigned: { label: "Spare", variant: "neutral", dotClass: "bg-zinc-400" },
  lost: { label: "Lost", variant: "warning", dotClass: "bg-amber-400" },
  revoked: { label: "Revoked", variant: "danger", dotClass: "bg-red-400" },
  replaced: { label: "Replaced", variant: "neutral", dotClass: "bg-zinc-500" },
};

export const BADGE_STATUS_FILTER_OPTIONS = [
  { value: "all", label: "All statuses" },
  { value: "active", label: "Active" },
  { value: "unassigned", label: "Spare" },
  { value: "uid_pending", label: "UID pending" },
  { value: "lost", label: "Lost" },
  { value: "revoked", label: "Revoked" },
  { value: "replaced", label: "Replaced" },
];

export const BATCH_SOURCE_MAP = {
  import: { label: "Imported", variant: "info", dotClass: "bg-sky-400" },
  generated: { label: "Serial range", variant: "purple", dotClass: "bg-violet-400" },
  desk: { label: "Binding desk", variant: "neutral", dotClass: "bg-zinc-400" },
  manual: { label: "Manual", variant: "neutral", dotClass: "bg-zinc-400" },
};

export const PURPOSE_OPTIONS = [
  { value: "gate", label: "Gate", hint: "Admits at the door and records presence. Charges per the point's billing mode." },
  { value: "session", label: "Session", hint: "Checks the holder into the linked session. Never charges." },
  { value: "lead", label: "Lead capture", hint: "Saves the holder as a lead for the linked exhibitor — once per exhibitor. Never charges." },
  { value: "payment", label: "Payment", hint: "Charges per the point's billing mode without admitting — bars, merch, rides." },
  { value: "info", label: "Info", hint: "Logs the tap only — footfall counters, photo spots, wayfinding." },
];

export const PURPOSE_MAP = {
  gate: { label: "Gate", variant: "success", dotClass: "bg-emerald-400" },
  session: { label: "Session", variant: "info", dotClass: "bg-sky-400" },
  lead: { label: "Lead capture", variant: "purple", dotClass: "bg-violet-400" },
  payment: { label: "Payment", variant: "warning", dotClass: "bg-amber-400" },
  info: { label: "Info", variant: "neutral", dotClass: "bg-zinc-400" },
};

export const OUTCOME_MAP = {
  admitted: { label: "Admitted", variant: "success", dotClass: "bg-emerald-400" },
  already_in: { label: "Already in", variant: "neutral", dotClass: "bg-zinc-400" },
  checked_in: { label: "Checked in", variant: "info", dotClass: "bg-sky-400" },
  lead_captured: { label: "New lead", variant: "purple", dotClass: "bg-violet-400" },
  lead_repeat: { label: "Repeat visit", variant: "neutral", dotClass: "bg-zinc-400" },
  charged: { label: "Charged", variant: "warning", dotClass: "bg-amber-400" },
  free: { label: "No charge", variant: "neutral", dotClass: "bg-zinc-400" },
  logged: { label: "Logged", variant: "neutral", dotClass: "bg-zinc-400" },
  rejected: { label: "Refused", variant: "danger", dotClass: "bg-red-400" },
};

export const BIND_ERRORS = {
  NO_ACCESS: "You don't have access to this event.",
  MISSING_UID: "Tap or type a chip UID first.",
  MISSING_ATTENDEE: "Pick who this badge belongs to.",
  UID_TAKEN: "That chip is already bound to someone else.",
  UID_INACTIVE: "That chip was lost, revoked or replaced — use a fresh badge.",
  NOT_FOUND: "That badge no longer exists.",
  NOT_REPLACEABLE: "Only a bound badge can be replaced.",
  SAME_UID: "That's the same chip — tap the new badge.",
  REPLACED: "Replaced badges can't change status.",
  BAD_STATUS: "Unknown status.",
  BAD_BATCH: "That batch no longer exists.",
};

export const formatDateTime = (iso) => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return d.toLocaleString("en-US", { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

// "3m ago" style, falling back to a date after a week.
export function timeAgo(iso, now = Date.now()) {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const s = Math.max(0, Math.round((now - t) / 1000));
  if (s < 60) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m}m ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h}h ago`;
  const d = Math.round(h / 24);
  if (d < 7) return `${d}d ago`;
  return formatDateTime(iso);
}

export const startOfToday = () => {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
};

export const plural = (n, word, many = `${word}s`) => `${n} ${n === 1 ? word : many}`;

// Badge -> what the table and drawer print for the holder.
export function holderOf(badge, rosterByKey) {
  if (!badge) return null;
  const key =
    badge.attendeeKey ||
    (badge.registrationId ? `reg:${badge.registrationId}` : badge.orderId ? `order:${badge.orderId}:0` : null);
  const person = key ? rosterByKey?.get(key) : null;
  const holder = badge.holder || {};
  const name = badge.label || person?.name || "";
  if (!name && !key) return null;
  return {
    key,
    name: name || "Unnamed holder",
    email: person?.email || holder.email || "",
    company: person?.company || holder.company || "",
    title: person?.title || holder.title || "",
    tier: person?.tier || holder.tier || "",
    role: person?.role || holder.role || "",
    code: person?.code || holder.code || "",
  };
}

export const badgeTitle = (badge) => badge?.serial || badge?.uid || "Badge";
