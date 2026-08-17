"use client";

// Who a pass is for, beyond the ticket tier. An event prints passes for more
// than its buyers — speakers, sponsors, exhibitors, crew — and those need their
// own designs. A pass carries a `role`; a template can bind to roles the same
// way it binds to tiers, and a role binding is the more specific match.
//
// `source` names where the people come from: "attendee" roles are derived from
// the ticket list, the rest are pulled from their own records by
// listPassAttendees().

export const PASS_ROLES = [
  {
    value: "Attendee",
    label: "Attendee",
    desc: "Everyone holding a ticket or registration.",
    accent: "#6366f1",
    source: "attendee",
  },
  {
    value: "Guest",
    label: "Guest",
    desc: "Plus-ones registered alongside somebody else.",
    accent: "#0ea5e9",
    source: "attendee",
  },
  {
    value: "Speaker",
    label: "Speaker",
    desc: "Everyone presenting, from the Conference → Speakers list.",
    accent: "#f59e0b",
    source: "conference:speaker",
  },
  {
    value: "Sponsor",
    label: "Sponsor",
    desc: "Sponsor representatives, from Conference → Sponsors.",
    accent: "#a855f7",
    source: "conference:sponsor",
  },
  {
    value: "Exhibitor",
    label: "Exhibitor",
    desc: "Booth staff, from Conference → Expo Booths.",
    accent: "#14b8a6",
    source: "conference:booth",
  },
  {
    value: "Staff",
    label: "Staff",
    desc: "Co-hosts and admins on the event team.",
    accent: "#22c55e",
    source: "team",
  },
  {
    value: "Crew",
    label: "Crew",
    desc: "Check-in staff and stage crew on the event team.",
    accent: "#64748b",
    source: "team",
  },
  { value: "VIP", label: "VIP", desc: "Reserved for hand-picked guests.", accent: "#ec4899" },
  { value: "Press", label: "Press", desc: "Accredited media.", accent: "#ef4444" },
  { value: "Volunteer", label: "Volunteer", desc: "Unpaid helpers on the day.", accent: "#84cc16" },
  { value: "Organiser", label: "Organiser", desc: "The people running the event.", accent: "#f97316" },
  { value: "Vendor", label: "Vendor", desc: "Caterers, AV, and other suppliers.", accent: "#8b5cf6" },
];

export const PASS_ROLE_MAP = Object.fromEntries(PASS_ROLES.map((r) => [r.value, r]));

export const roleAccent = (role) => PASS_ROLE_MAP[role]?.accent || "#6366f1";

// Which event-team role becomes which pass role. Anything unlisted is Staff.
export const TEAM_ROLE_TO_PASS_ROLE = {
  Owner: "Organiser",
  Admin: "Organiser",
  "Co-host": "Staff",
  "Check-in staff": "Crew",
  Viewer: "Staff",
};

// The distinct roles actually present on an event's passes, in catalog order so
// the binding chips read consistently.
export function rolesOf(passes) {
  const seen = new Set();
  for (const p of passes || []) {
    const role = String(p?.role || "").trim();
    if (role) seen.add(role);
  }
  const known = PASS_ROLES.filter((r) => seen.has(r.value)).map((r) => r.value);
  const extra = [...seen].filter((r) => !PASS_ROLE_MAP[r]).sort();
  return [...known, ...extra];
}
