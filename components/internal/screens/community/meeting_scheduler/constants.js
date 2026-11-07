// Status maps, filters and small helpers shared by the Meeting Scheduler tabs.

export const REQUEST_STATUS_MAP = {
  pending: { label: "Pending", variant: "warning", dotClass: "bg-amber-400" },
  accepted: { label: "Accepted", variant: "success", dotClass: "bg-emerald-400" },
  declined: { label: "Declined", variant: "danger", dotClass: "bg-red-400" },
  cancelled: { label: "Cancelled", variant: "neutral", dotClass: "bg-[#737373]" },
  expired: { label: "Expired", variant: "neutral", dotClass: "bg-[#737373]" },
};

export const MEETING_STATUS_MAP = {
  scheduled: { label: "Scheduled", variant: "info", dotClass: "bg-sky-400" },
  completed: { label: "Completed", variant: "success", dotClass: "bg-emerald-400" },
  no_show: { label: "No-show", variant: "warning", dotClass: "bg-amber-400" },
  cancelled: { label: "Cancelled", variant: "danger", dotClass: "bg-red-400" },
};

export const PROFILE_STATUS_MAP = {
  opted_in: { label: "Opted in", variant: "success", dotClass: "bg-emerald-400" },
  opted_out: { label: "Opted out", variant: "neutral", dotClass: "bg-[#737373]" },
  hidden: { label: "Hidden", variant: "danger", dotClass: "bg-red-400" },
};

export const REQUEST_FILTER_OPTIONS = [
  { value: "all", label: "All Statuses" },
  ...Object.entries(REQUEST_STATUS_MAP).map(([value, m]) => ({ value, label: m.label })),
];

export const DIRECTORY_FILTER_OPTIONS = [
  { value: "all", label: "All Profiles" },
  { value: "opted_in", label: "Opted in" },
  { value: "opted_out", label: "Opted out" },
  { value: "hidden", label: "Hidden" },
];

export const ROLE_FILTER_OPTIONS = [
  { value: "all", label: "All Roles" },
  { value: "attendee", label: "Attendees" },
  { value: "exhibitor", label: "Exhibitors" },
];

export const profileStatus = (p) => (p.hidden ? "hidden" : p.optedIn ? "opted_in" : "opted_out");

export function initials(name) {
  const parts = String(name || "").trim().split(/\s+/).filter(Boolean);
  if (!parts.length) return "?";
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0].slice(0, 2).toUpperCase();
}

export const personName = (people, id) => people.get(id)?.name || "Former attendee";

export function formatStamp(iso) {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleString("en-US", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// Read at call time so render stays pure.
export const isFuture = (iso) => Date.parse(iso) > Date.now();

export const slugify = (v) =>
  String(v || "event").replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "").toLowerCase() || "event";

// Everyone the organiser can see for this event: ticket holders, overlaid with their networking profile.
export function buildPeople(attendees, profiles) {
  const map = new Map();
  for (const a of attendees || []) {
    map.set(a.memberId, {
      memberId: a.memberId,
      name: a.name || a.email.split("@")[0] || "Attendee",
      email: a.email,
      ticketName: a.ticketName,
      hasTicket: true,
      company: "",
      title: "",
      role: "attendee",
      profile: null,
    });
  }
  for (const p of profiles || []) {
    const cur = map.get(p.memberId);
    map.set(p.memberId, {
      memberId: p.memberId,
      name: p.displayName || cur?.name || p.email.split("@")[0] || "Attendee",
      email: cur?.email || p.email,
      ticketName: cur?.ticketName || "",
      hasTicket: Boolean(cur),
      company: p.company,
      title: p.title,
      role: p.role,
      profile: p,
    });
  }
  return map;
}
