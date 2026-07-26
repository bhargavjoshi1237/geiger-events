"use client";

import { listRegistrationsByEvent } from "@/lib/supabase/registrations";
import { listOrders } from "@/lib/supabase/orders";
import { listAssignments } from "@/lib/supabase/seating";

// The people a pass gets printed for. Free/RSVP events write registrations,
// paid events write orders, and only orders carry a ticket tier — so the pass
// printer reads both and merges them into one flat list, one entry per physical
// pass.

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

// Every pass for an event, sorted by name. Returns [] when there's nothing to
// print and null only when both reads fail (the screen shows an empty state
// either way, but null lets it distinguish a real failure).
export async function listPassAttendees(eventId) {
  if (!eventId) return [];
  const [regs, orders, seatRows] = await Promise.all([
    listRegistrationsByEvent(eventId),
    listOrders(eventId),
    listAssignments(eventId),
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
        name: order.name || "Attendee",
        email: order.email || "",
        company: "",
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
      name: reg.name || "Attendee",
      email: reg.email || "",
      company,
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
        name: guest,
        email: reg.email || "",
        company,
        tier: reg.ticket || reg.ticketType || "",
        code: passCode(reg.id),
        payload: reg.id,
        seat: i + 2,
        of: total,
      });
    });
  }

  return out.sort((a, b) => a.name.localeCompare(b.name));
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
