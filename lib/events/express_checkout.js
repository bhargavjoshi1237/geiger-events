import { slotBookingRequired } from "./slots";
import { hasPurchasables, normalizePurchasable } from "./purchasables";
import { groupPurchaseEnabled, groupConfig, groupAllowsTicket } from "./group";
import { ticketAvailable } from "./reserved";
import { activePurchaseDisclaimer } from "./purchase_disclaimer";

export const EXPRESS_NAME = "Express Lane";

export const EXPRESS_DEFAULTS = {
  enabled: false,
  placement: "alongside",
  buttonLabel: "Express checkout",
  tagline: "Two clicks to your tickets",
  defaultTicket: "selected",
  allowTicketSwitch: true,
  allowQuantity: true,
  maxQty: 6,
  collectName: true,
  prefillSignedIn: true,
  showFullCheckout: true,
};

export const EXPRESS_PLACEMENTS = {
  alongside: "Extra button under Get Tickets",
  replace: "Get Tickets opens Express Lane",
};

export function expressConfig(event) {
  return { ...EXPRESS_DEFAULTS, ...(event?.express || {}) };
}

const NAME_OR_EMAIL = /^(full\s*)?name$|^e-?mail$/i;

// Event-wide settings that need input Stripe can't collect — any one forces the full checkout.
export function expressBlockers(event) {
  if (!event) return [];
  const out = [];
  const add = (id, label, section, key) => out.push({ id, label, section, key });

  if (event.payments?.enabled === false) add("payments", "Online payments are switched off", "Payments", "payments");
  if (event.seating?.seatMapId) add("seating", "Assigned seating needs buyers to pick seats", "Seating", "seating");
  if (event.expo?.hallMapId) add("expo", "The exhibitor floor needs buyers to pick a booth", "Exhibitor Floor", "expo");
  if (event.rsvp?.requireApproval) add("approval", "Registrations need your approval first", "RSVP Options", "rsvp");
  if (slotBookingRequired(event)) add("slots", "A time slot is required at checkout", "Slots", "slots");

  const offerings = hasPurchasables(event)
    ? []
    : (Array.isArray(event.offerings) ? event.offerings : []).filter((o) => o?.enabled);
  if (offerings.some((o) => o.required)) add("offerings", "An offering is marked required", "Offerings", "offerings");

  const purs = hasPurchasables(event)
    ? event.purchasables.map(normalizePurchasable).filter((p) => p && p.enabled !== false)
    : [];
  if (purs.some((p) => p.required)) add("purchasables", "A purchasable is marked required", "Purchasables", "purchasables");

  const questions = (Array.isArray(event.questions) ? event.questions : []).filter(
    (q) => q?.label && !NAME_OR_EMAIL.test(q.label.trim()),
  );
  if (questions.some((q) => q.required)) add("questions", "A required registration question", "Custom Questions", "questions");

  return out;
}

// Most a buyer can take in Express — group pricing needs attendee emails, so stay under it.
export function expressQtyCap(event, ticketId) {
  const cfg = expressConfig(event);
  const cap = cfg.allowQuantity ? Math.max(1, Number(cfg.maxQty) || 1) : 1;
  if (!groupPurchaseEnabled(event) || !groupAllowsTicket(event, ticketId)) return cap;
  return Math.max(1, Math.min(cap, groupConfig(event).minSeats - 1));
}

// Paid, in stock, and not already capped at zero by its released waves.
export function expressTicketEligible(event, ticket) {
  if (!ticket || !(Number(ticket.price) > 0)) return false;
  if (ticketAvailable(event, ticket, event?.ticketSold || {}) <= 0) return false;
  const rs = ticket.releaseState;
  if (rs?.hasReleases && Number.isFinite(rs.remaining) && rs.remaining <= 0) return false;
  return true;
}

export function expressTickets(event, tickets) {
  return (tickets || []).filter((t) => expressTicketEligible(event, t));
}

// Null when Express Lane can't run for this event at all.
export function activeExpress(event, tickets) {
  const cfg = expressConfig(event);
  if (!cfg.enabled || expressBlockers(event).length) return null;
  if (!expressTickets(event, tickets).length) return null;
  return cfg;
}

// Click budget from the page to Stripe: open + pay, plus a tick-box if the purchase disclaimer demands one.
export function expressClicks(event) {
  const gate = activePurchaseDisclaimer(event, { isFree: false });
  return 2 + (gate?.requireCheck ? 1 : 0);
}
