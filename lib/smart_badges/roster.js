// Who can hold a smart badge, and how a badge points back at them. Built on the Badge Printing roster
// (lib/passes/attendees.js) so a chip and a printed pass agree on the holder key. Pure.

import { compareSerial } from "./uid";

const norm = (s) => String(s || "").trim().toLowerCase();

// Pass roster row -> the binding payload smart_badge_bind / _assign / _import expect.
export function holderPayload(person) {
  if (!person) return null;
  return {
    registration_id: person.source === "registration" ? person.id : null,
    order_id: person.source === "order" ? person.id : null,
    attendee_key: person.key,
    label: person.name || "",
    holder: {
      email: person.email || "",
      company: person.company || "",
      title: person.title || "",
      tier: person.tier || "",
      role: person.role || "",
      code: person.code || "",
    },
  };
}

// The roster key a badge belongs to. Legacy RFID / NFC bindings carry only a registration id.
export function badgeHolderKey(badge) {
  if (!badge) return null;
  if (badge.attendeeKey) return badge.attendeeKey;
  if (badge.registrationId) return `reg:${badge.registrationId}`;
  if (badge.orderId) return `order:${badge.orderId}:0`;
  return null;
}

export const isBound = (badge) =>
  !!(badge && (badge.registrationId || badge.orderId || badge.attendeeKey || (badge.label && badge.status !== "unassigned")));

// Roster key -> the holder's live (active or lost) badges.
export function liveBadgesByHolder(badges) {
  const map = new Map();
  for (const b of badges || []) {
    if (b.status !== "active" && b.status !== "lost") continue;
    const key = badgeHolderKey(b);
    if (!key) continue;
    if (!map.has(key)) map.set(key, []);
    map.get(key).push(b);
  }
  return map;
}

export function searchRoster(roster, query, limit = 30) {
  const q = norm(query);
  const list = roster || [];
  if (!q) return list.slice(0, limit);
  const compact = q.replace(/\s+/g, "");
  return list
    .filter(
      (p) =>
        norm(p.name).includes(q) ||
        norm(p.email).includes(q) ||
        norm(p.company).includes(q) ||
        norm(p.code).includes(compact),
    )
    .slice(0, limit);
}

export const ROLE_FILTERS = [
  { value: "all", label: "Everyone" },
  { value: "attendees", label: "Attendees & guests" },
  { value: "Speaker", label: "Speakers" },
  { value: "Sponsor", label: "Sponsors" },
  { value: "Exhibitor", label: "Exhibitors" },
  { value: "staff", label: "Team & staff" },
];

const STAFF_ROLES = new Set(["Staff", "Crew", "Organizer", "Organiser", "Volunteer", "Press", "Media", "Security"]);

export function matchesRole(person, role) {
  if (!role || role === "all") return true;
  if (role === "attendees") return person.role === "Attendee" || person.role === "Guest";
  if (role === "staff") return person.source === "team" || STAFF_ROLES.has(person.role);
  return person.role === role;
}

// Pair a batch's spare badges with roster people who have no live badge yet, in guest-list order.
export function planAutoAssign({ badges, roster, batchId, role = "all", tier = "all", order = "name" }) {
  const live = liveBadgesByHolder(badges);
  const spare = (badges || [])
    .filter((b) => b.status === "unassigned" && (!batchId || b.batchId === batchId))
    .sort((a, b) => compareSerial(a.serial, b.serial) || compareSerial(a.uid, b.uid));
  const people = (roster || [])
    .filter((p) => !live.has(p.key))
    .filter((p) => matchesRole(p, role))
    .filter((p) => tier === "all" || norm(p.tier) === norm(tier))
    .sort((a, b) =>
      order === "tier"
        ? String(a.tier || "~").localeCompare(String(b.tier || "~")) || a.name.localeCompare(b.name)
        : a.name.localeCompare(b.name),
    );
  const pairs = [];
  const n = Math.min(spare.length, people.length);
  for (let i = 0; i < n; i += 1) pairs.push({ badge: spare[i], person: people[i] });
  return { pairs, spare: spare.length, waiting: people.length };
}
