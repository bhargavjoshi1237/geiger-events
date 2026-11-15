// Server-side checkout pricing: every amount comes from the event's own config and the buyer's live holds, never from the browser.
// Mirrors the storefront's derivePricing (public_page/checkout/pricing.js), so the charge matches what the buyer was shown.

import { buildTickets } from "@/components/internal/screens/events/public_page/tickets";
import { bundlePrice, eventBundles } from "@/lib/events/bundles";
import { earlybirdEnabled, earlybirdReduction } from "@/lib/events/earlybird";
import { isGroupQty } from "@/lib/events/group";
import { hasPurchasables, purchasableUnitPrice, visiblePurchasables } from "@/lib/events/purchasables";
import { eventSlots, slotBookingEnabled } from "@/lib/events/slots";

const fail = (error, status = 400) => ({ ok: false, error, status });
const same = (a, b) => a != null && b != null && String(a) === String(b);

function eventTickets(event) {
  return Array.isArray(event.tickets) ? event.tickets : [];
}

// The ticket line: a bundle, one of the event's tickets, or the page's stand-in ticket when the event lists none.
function resolveTicket(event, { ticketId, bundleId }) {
  if (bundleId) {
    const bundle = eventBundles(event).find((b) => same(b.id, bundleId));
    if (!bundle) return null;
    const priceById = Object.fromEntries(eventTickets(event).map((t) => [String(t.id), Number(t.price) || 0]));
    return { name: bundle.name, price: bundlePrice(bundle, priceById) };
  }
  if (ticketId != null) {
    const ticket = eventTickets(event).find((t) => same(t.id, ticketId));
    return ticket ? { name: ticket.name || "Ticket", price: Number(ticket.price) || 0 } : null;
  }
  if (eventTickets(event).length) return null;
  const [standIn] = buildTickets(event);
  return standIn ? { name: standIn.name, price: Number(standIn.price) || 0 } : null;
}

// Seats must all sit in sections sold under the ticket being bought, as the seat picker enforces.
function priceSeats(event, ticketId, seats) {
  if (!seats.length) return fail("Your seat hold ran out. Please pick your seats again.", 409);
  const sectionTiers = event.seating?.sectionTiers || {};
  if (!seats.every((seat) => same(sectionTiers[seat.sectionId], ticketId))) {
    return fail("Those seats aren't sold under this ticket. Please pick your seats again.", 409);
  }
  return { ok: true, qty: seats.length };
}

// Booths sell at their own prices (direct) or at their package's ticket price (tier), as the booth picker enforces.
function priceBooths(event, ticketId, booths) {
  if (!booths.length) return fail("Your booth hold ran out. Please pick your stand again.", 409);
  if (event.expo?.pricing === "direct") {
    const sum = booths.reduce((total, booth) => total + (Number(booth.price) || 0), 0);
    return { ok: true, qty: booths.length, price: sum / booths.length };
  }
  const boothTiers = event.expo?.boothTiers || {};
  if (!booths.every((booth) => same(boothTiers[booth.boothId], ticketId))) {
    return fail("Those booths aren't sold under this package. Please pick your stand again.", 409);
  }
  return { ok: true, qty: booths.length };
}

function resolveSlot(event, slotId, ticketId) {
  if (slotId == null || slotId === "" || !slotBookingEnabled(event)) return { slot: null, delta: 0 };
  const slot = eventSlots(event, { ticketId: ticketId ?? undefined })
    .filter((s) => s.enabled !== false)
    .find((s) => same(s.id, slotId));
  if (!slot) return null;
  const delta = Number(slot.priceDelta) || 0;
  return { slot: { id: slot.id, label: slot.label, band: slot.band, start: slot.start || "", priceDelta: delta }, delta };
}

// Offering choices re-priced from the event's own options; anything the event doesn't offer for this ticket is dropped.
function priceOfferings(event, ticketName, requested) {
  const offerings = (Array.isArray(event.offerings) ? event.offerings : [])
    .filter((o) => o.enabled && Array.isArray(o.options) && o.options.length)
    .filter((o) => o.appliesTo === "all" || (Array.isArray(o.appliesTo) && o.appliesTo.includes(ticketName)));

  let unit = 0;
  const selections = [];
  for (const offering of offerings) {
    const asked = (Array.isArray(requested) ? requested : []).find((s) => s?.offering === offering.name);
    if (!asked) continue;
    const labels = new Set((Array.isArray(asked.choices) ? asked.choices : []).map((c) => c?.label));
    const picked = offering.options.filter((opt) => labels.has(opt.label));
    const choices = (offering.selectionType === "single" ? picked.slice(0, 1) : picked).map((opt) => ({
      label: opt.label,
      price: Number(opt.price) || 0,
    }));
    if (!choices.length) continue;
    unit += choices.reduce((sum, c) => sum + c.price, 0);
    selections.push({ offering: offering.name, type: offering.selectionType, choices });
  }
  return { unit, selections: selections.length ? selections : null };
}

// Purchasables re-priced from the event's catalogue, limited to the ones its rules show for this order.
function pricePurchasables(event, context, requested) {
  const wanted = new Map();
  for (const p of Array.isArray(requested) ? requested : []) {
    const count = Math.max(0, Math.floor(Number(p?.quantity) || 0));
    if (p?.id != null && count > 0) wanted.set(String(p.id), count);
  }
  const visible = visiblePurchasables(event, { ...context, isMember: false, selectedIds: [...wanted.keys()] });

  let unit = 0;
  const purchasables = [];
  for (const p of visible) {
    let count = wanted.get(String(p.id));
    if (!count) continue;
    if (p.pickType !== "quantity") count = 1;
    else if (p.maxPerOrder) count = Math.min(count, p.maxPerOrder);
    const total = purchasableUnitPrice(p, p.pickType === "quantity" ? count : true);
    unit += total;
    purchasables.push({ id: p.id, name: p.name, pickType: p.pickType, quantity: count, price: p.price, total });
  }
  return { unit, purchasables: purchasables.length ? purchasables : null };
}

// `seats` and `booths` are the buyer's live holds ({ sectionId } / { boothId, price }), or null when the order has none.
export function priceCheckout(event, input, { seats = null, booths = null } = {}) {
  const { ticketId = null, bundleId = null, quantity, slotId = null, selections, purchasables, attendees } = input;

  const ticket = resolveTicket(event, { ticketId: bundleId ? null : ticketId, bundleId });
  if (!ticket) return fail("That ticket isn't on sale any more. Please refresh the page.", 409);

  let price = ticket.price;
  let qty = Math.max(1, Math.floor(Number(quantity) || 1));
  if (seats) {
    const seated = priceSeats(event, ticketId, seats);
    if (!seated.ok) return seated;
    qty = seated.qty;
  } else if (booths) {
    const boothed = priceBooths(event, ticketId, booths);
    if (!boothed.ok) return boothed;
    qty = boothed.qty;
    if (boothed.price != null) price = boothed.price;
  }

  const slotResult = resolveSlot(event, slotId, bundleId ? null : ticketId);
  if (!slotResult) return fail("That time slot isn't available any more. Please pick another.", 409);

  const pricedTicketId = bundleId ? null : ticketId;
  const offered = hasPurchasables(event) ? { unit: 0, selections: null } : priceOfferings(event, ticket.name, selections);
  const extras = hasPurchasables(event)
    ? pricePurchasables(event, { slot: slotResult.slot, ticketId: pricedTicketId, ticketName: ticket.name, qty }, purchasables)
    : { unit: 0, purchasables: null };

  // A group order fans out to one ticket per attendee and earns the group discount, so it must meet the event's group rules.
  const isGroup = !bundleId && isGroupQty(event, pricedTicketId, qty);
  const attendeeList = isGroup && Array.isArray(attendees) && attendees.length === qty ? attendees : null;

  const earlybird = !bundleId && earlybirdEnabled(event) ? earlybirdReduction(event, price) : 0;

  return {
    ok: true,
    ticketName: ticket.name,
    price,
    unitPrice: Math.max(0, price - earlybird),
    qty,
    addonUnit: offered.unit + extras.unit + slotResult.delta,
    selections: offered.selections,
    purchasables: extras.purchasables,
    slot: slotResult.slot,
    attendees: attendeeList,
    isGroup: Boolean(attendeeList),
  };
}
