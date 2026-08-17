"use client";

import { listRegistrationsByEvent } from "@/lib/supabase/registrations";
import { listOrders } from "@/lib/supabase/orders";
import { listAssignments } from "@/lib/supabase/seating";
import { listEventTeam } from "@/lib/supabase/event_team";
import { conferenceApi } from "@/lib/supabase/conference";
import { TEAM_ROLE_TO_PASS_ROLE } from "./roles";

// The people a pass gets printed for. Free/RSVP events write registrations,
// paid events write orders, and only orders carry a ticket tier — so the pass
// printer reads both and merges them into one flat list, one entry per physical
// pass.
//
// A ticket isn't the only reason to wear a badge, so the list also carries the
// event's own people — speakers, sponsor reps, booth staff, crew — each stamped
// with a `role` a template can bind a distinct design to. Those rows have no
// ticket and no scannable payload; they exist to be printed.

// Short human-readable code shown on the pass. Matches the format the check-in
// screens already display for a registration.
export const passCode = (id) =>
  String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();

const norm = (s) => String(s || "").trim().toLowerCase();

const SKIP_REGISTRATION = /waitlist|cancel|declin|reject/i;

// Neither table has a company column, so it comes out of the registration's
// custom answers / metadata bag when the organiser collected it.
function companyOf(reg) {
  if (reg.company) return String(reg.company);
  const answers = reg.answers && typeof reg.answers === "object" ? reg.answers : {};
  const key = Object.keys(answers).find((k) =>
    /company|organi[sz]ation|employer|business/i.test(k),
  );
  const value = key ? answers[key] : "";
  return typeof value === "string" ? value : "";
}

const plusOneName = (entry) => {
  if (!entry) return "";
  if (typeof entry === "string") return entry;
  return String(entry.name || entry.fullName || "");
};

// The event's own people, as passes. Speakers, sponsor contacts and booth staff
// are project-scoped conference records; the team is per event. Each returns []
// when its area is unused, so an event that runs none of them is unaffected.
async function listRolePasses(eventId, projectId) {
  const [team, speakers, sponsors, booths] = await Promise.all([
    listEventTeam(eventId),
    projectId ? conferenceApi.list(projectId, "speaker") : [],
    projectId ? conferenceApi.list(projectId, "sponsor") : [],
    projectId ? conferenceApi.list(projectId, "booth") : [],
  ]);

  const out = [];
  const base = (role, id, prefix) => ({
    key: `${prefix}:${id}`,
    id,
    source: prefix,
    role,
    tier: "",
    code: passCode(id),
    payload: id,
    seat: 1,
    of: 1,
  });

  // Event access is granted directly, so every grant is a real member who can
  // hold a pass — there is no longer a pending state to hold anyone back.
  for (const member of team || []) {
    if (!member) continue;
    out.push({
      ...base(TEAM_ROLE_TO_PASS_ROLE[member.role] || "Staff", member.id, "team"),
      name: member.name || member.email || "Team member",
      email: member.email || "",
      company: "",
      title: member.role || "",
      detail: member.role || "",
    });
  }

  for (const rec of speakers || []) {
    if (!rec) continue;
    const config = rec.config || {};
    out.push({
      ...base("Speaker", rec.id, "speaker"),
      name: rec.name || "Speaker",
      email: config.email || "",
      company: config.company || "",
      title: config.title || "",
      // The badge line that says why they're here: their first session, or
      // failing that their topics.
      detail: (config.sessions || [])[0] || (config.topics || []).slice(0, 2).join(" · "),
    });
  }

  for (const rec of sponsors || []) {
    if (!rec?.config?.contactName) continue;
    const config = rec.config;
    out.push({
      ...base("Sponsor", rec.id, "sponsor"),
      name: config.contactName,
      email: config.contactEmail || "",
      company: rec.name || "",
      title: "Sponsor",
      detail: rec.name || "",
    });
  }

  for (const rec of booths || []) {
    if (!rec?.config?.exhibitor) continue;
    const config = rec.config;
    out.push({
      ...base("Exhibitor", rec.id, "booth"),
      name: config.exhibitor,
      email: "",
      company: config.exhibitor,
      title: "Exhibitor",
      detail: [rec.name, config.hall].filter(Boolean).join(" · "),
    });
  }

  return out;
}

// Every pass for an event, sorted by name. Returns [] when there's nothing to
// print and null only when both ticket reads fail (the screen shows an empty
// state either way, but null lets it distinguish a real failure).
export async function listPassAttendees(eventId, projectId) {
  if (!eventId) return [];
  const [regs, orders, seatRows, rolePasses] = await Promise.all([
    listRegistrationsByEvent(eventId),
    listOrders(eventId),
    listAssignments(eventId),
    listRolePasses(eventId, projectId),
  ]);
  if (regs === null && orders === null) return null;

  const out = [];
  const orderEmails = new Set();

  // Assigned seats per order, in a stable order, so the Nth pass of an order
  // carries the Nth seat. Empty for events without a seat map.
  const seatsByOrder = new Map();
  for (const row of seatRows || []) {
    if (!row.orderId) continue;
    if (!seatsByOrder.has(row.orderId)) seatsByOrder.set(row.orderId, []);
    seatsByOrder.get(row.orderId).push(row);
  }
  for (const list of seatsByOrder.values()) {
    list.sort((a, b) => String(a.seatId).localeCompare(String(b.seatId)));
  }

  for (const order of orders || []) {
    if (!order) continue;
    // A cancelled or fully refunded order shouldn't get a pass at the door.
    if (order.displayStatus === "Cancelled" || order.displayStatus === "Refunded") continue;
    if (order.email) orderEmails.add(norm(order.email));

    const qty = Math.max(1, Number(order.quantity) || 1);
    for (let i = 0; i < qty; i += 1) {
      out.push({
        key: `order:${order.id}:${i}`,
        id: order.id,
        source: "order",
        role: "Attendee",
        name: order.name || "Attendee",
        email: order.email || "",
        company: "",
        title: "",
        detail: "",
        tier: order.ticket || "",
        code: passCode(order.id),
        // Seats on one order share the order's code, exactly as the buyer
        // portal shows a single QR for a multi-seat order. The seat label is
        // what tells the printed passes apart.
        payload: order.id,
        seat: i + 1,
        of: qty,
        // The physical assigned seat, when this event sells one. `seat` above
        // is the "n of m" counter and stays untouched.
        seatLabel: seatsByOrder.get(order.id)?.[i]?.label || "",
      });
    }
  }

  for (const reg of regs || []) {
    if (!reg) continue;
    if (SKIP_REGISTRATION.test(String(reg.status || ""))) continue;
    // A buyer who also RSVP'd would otherwise print twice; the order wins
    // because it carries the tier.
    if (reg.email && orderEmails.has(norm(reg.email))) continue;

    const guests = (Array.isArray(reg.plusOnes) ? reg.plusOnes : [])
      .map(plusOneName)
      .filter(Boolean);
    const company = companyOf(reg);
    const total = guests.length + 1;

    out.push({
      key: `reg:${reg.id}`,
      id: reg.id,
      source: "registration",
      role: "Attendee",
      name: reg.name || "Attendee",
      email: reg.email || "",
      company,
      title: "",
      detail: "",
      tier: reg.ticket || reg.ticketType || "",
      code: passCode(reg.id),
      payload: reg.id,
      seat: 1,
      of: total,
    });

    guests.forEach((guest, i) => {
      out.push({
        key: `reg:${reg.id}:guest:${i}`,
        id: reg.id,
        source: "registration",
        // A plus-one is somebody else's guest, and often wants its own design.
        role: "Guest",
        name: guest,
        email: reg.email || "",
        company,
        title: "",
        detail: "",
        tier: reg.ticket || reg.ticketType || "",
        code: passCode(reg.id),
        payload: reg.id,
        seat: i + 2,
        of: total,
      });
    });
  }

  return [...out, ...(rolePasses || [])].sort((a, b) => a.name.localeCompare(b.name));
}

// The distinct tier names present on an event's passes — what the designer
// offers when binding a template to tiers.
export function tiersOf(attendees) {
  const seen = new Map();
  for (const a of attendees || []) {
    const tier = String(a.tier || "").trim();
    if (tier && !seen.has(norm(tier))) seen.set(norm(tier), tier);
  }
  return [...seen.values()].sort((a, b) => a.localeCompare(b));
}
