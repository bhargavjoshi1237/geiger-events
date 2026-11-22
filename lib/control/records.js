import { blockedMessage } from "../checkin/scan.js";
import { ApiError } from "../staff_access/errors.js";

// Control's view models and request parsers for orders, guests, check-in and the inbox; camelCase out, validated in.

export const ORDER_COLUMNS =
  "id,event_id,project_id,buyer_name,buyer_email,ticket_name,ticket_price,quantity,total,refunded_total,status,cancelled_at,created_at,note:metadata->>note";
export const REGISTRATION_COLUMNS = "id,event_id,name,email,phone,status,source,party_size,dietary,accessibility,created_at";
export const REGISTRATION_STATUSES = ["Confirmed", "Pending", "Waitlisted", "Declined", "Checked-in", "Cancelled"];
export const ORDER_FILTERS = ["all", "paid", "refunded", "cancelled"];
export const REFUND_REASONS = ["requested_by_customer", "event_cancelled", "duplicate", "fraudulent", "other"];

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function invalid(message) {
  return new ApiError("invalid_input", 400, message);
}

export function ticketCode(id) {
  return String(id || "").replace(/-/g, "").slice(0, 8).toUpperCase();
}

// Same derivation as the dashboard's Orders cockpit.
export function orderStatus(row) {
  if (row?.cancelled_at) return "Cancelled";
  const total = Number(row?.total ?? 0);
  const refunded = Number(row?.refunded_total ?? 0);
  if (refunded > 0 && refunded >= total && total > 0) return "Refunded";
  if (refunded > 0) return "Partially refunded";
  return "Paid";
}

export function orderView(row, eventName = "", currency = "usd") {
  const total = Number(row.total ?? 0);
  const refunded = Number(row.refunded_total ?? 0);
  return {
    id: row.id,
    code: ticketCode(row.id),
    eventId: row.event_id ?? null,
    eventName,
    currency: String(currency || "usd").toLowerCase(),
    name: row.buyer_name ?? "",
    email: row.buyer_email ?? "",
    ticket: row.ticket_name ?? "",
    unitPrice: Number(row.ticket_price ?? 0),
    quantity: Number(row.quantity ?? 1),
    total,
    refunded,
    refundable: row.cancelled_at ? 0 : Math.max(0, Math.round((total - refunded) * 100) / 100),
    status: orderStatus(row),
    cancelled: Boolean(row.cancelled_at),
    note: row.note ?? "",
    createdAt: row.created_at ?? null,
  };
}

export function refundView(row) {
  return {
    id: row.id,
    amount: Number(row.amount ?? 0),
    reason: row.reason ?? "",
    reasonCode: row.reason_code ?? "other",
    status: row.status ?? "Requested",
    createdAt: row.created_at ?? null,
  };
}

export function timelineView(row) {
  return {
    id: row.id,
    type: row.type ?? "note",
    summary: row.summary ?? "",
    amount: row.amount == null ? null : Number(row.amount),
    actor: row.actor ?? "",
    createdAt: row.created_at ?? null,
  };
}

// PostgREST's or() grammar treats , ( ) as syntax, and % * as wildcards, so search text loses them.
export function searchTerm(value) {
  const term = String(value ?? "").replace(/[,()*%\\]/g, " ").replace(/\s+/g, " ").trim();
  return term.slice(0, 80);
}

export function parseOrderFilter(value) {
  return ORDER_FILTERS.includes(value) ? value : "all";
}

// An ISO timestamp cursor for "older than this", or null for the first page.
export function parseCursor(value) {
  if (!value) return null;
  const at = Date.parse(String(value));
  return Number.isNaN(at) ? null : new Date(at).toISOString();
}

export function parseOrderPatch(body) {
  if (!body || typeof body !== "object") throw invalid("Send the fields to change.");
  const patch = {};
  if ("name" in body) {
    const name = String(body.name ?? "").trim();
    if (!name || name.length > 200) throw invalid("Buyer name must be 1–200 characters.");
    patch.buyer_name = name;
  }
  if ("email" in body) {
    const email = String(body.email ?? "").trim().toLowerCase();
    if (!EMAIL.test(email) || email.length > 254) throw invalid("Enter a valid email address.");
    patch.buyer_email = email;
  }
  const note = "note" in body ? String(body.note ?? "").slice(0, 2000) : undefined;
  if (!Object.keys(patch).length && note === undefined) throw invalid("Send at least one field to change.");
  return { patch, note };
}

export function parseRefund(body, order) {
  const amount = Math.round(Number(body?.amount) * 100) / 100;
  if (!Number.isFinite(amount) || amount <= 0) throw invalid("Enter an amount above zero.");
  const available = orderView(order).refundable;
  if (amount > available) throw invalid(`At most ${available.toFixed(2)} can be refunded on this order.`);
  const reasonCode = REFUND_REASONS.includes(body?.reasonCode) ? body.reasonCode : "other";
  const reason = String(body?.reason ?? "").trim().slice(0, 500);
  return { amount, reasonCode, reason };
}

export function registrationView(row, checkedIn = false) {
  return {
    id: row.id,
    code: ticketCode(row.id),
    name: row.name ?? "",
    email: row.email ?? "",
    phone: row.phone ?? "",
    status: row.status ?? "Confirmed",
    source: row.source ?? "Online",
    partySize: Number(row.party_size ?? 1),
    dietary: row.dietary ?? "",
    accessibility: row.accessibility ?? "",
    checkedIn,
    createdAt: row.created_at ?? null,
  };
}

export function parseGuest(body) {
  const name = String(body?.name ?? "").trim();
  if (!name || name.length > 200) throw invalid("Guest name must be 1–200 characters.");
  const email = String(body?.email ?? "").trim().toLowerCase();
  if (email && (!EMAIL.test(email) || email.length > 254)) throw invalid("Enter a valid email address, or leave it blank.");
  const partySize = body?.partySize === undefined ? 1 : Number(body.partySize);
  if (!Number.isInteger(partySize) || partySize < 1 || partySize > 50) throw invalid("Party size must be 1–50.");
  const phone = String(body?.phone ?? "").trim().slice(0, 40);
  return { name, email, partySize, phone };
}

const HEX8 = /^[0-9a-f]{8}$/i;

// How a scan or typed code finds a ticket: an exact id, or an 8-character code as a uuid range (uuid order is byte order).
export function codeRange(code) {
  const hex = String(code ?? "").trim().replace(/-/g, "");
  if (!HEX8.test(hex)) return null;
  const lower = hex.toLowerCase();
  return { from: `${lower}-0000-0000-0000-000000000000`, to: `${lower}-ffff-ffff-ffff-ffffffffffff` };
}

// The admit core's result → one of four outcomes the app renders.
export function admitOutcome(result, fallbackName = "") {
  const name = result?.name || fallbackName || "";
  const party = Number(result?.party ?? 1) || 1;
  if (result?.ok) return { status: "admitted", name, party, message: party > 1 ? `Admitted, party of ${party}` : "Admitted" };
  if (result?.already) return { status: "already", name, party, message: "Already checked in" };
  if (result?.capacity) {
    return {
      status: "capacity",
      name,
      party,
      message: "This area is at capacity",
      canOverride: Boolean(result?.canOverride ?? true),
    };
  }
  return { status: "blocked", name, party, message: blockedMessage(result?.reason) };
}

export function threadView(row, extra = {}) {
  return {
    id: row.id,
    subject: row.subject || "Support request",
    status: row.status || "open",
    name: row.member_name || "",
    email: row.member_email || "",
    eventId: row.event_id ?? null,
    orderId: row.order_id ?? null,
    unread: Boolean(row.organiser_unread),
    lastMessageAt: row.last_message_at ?? null,
    preview: "",
    eventName: "",
    ...extra,
  };
}

export function messageView(row) {
  return { id: row.id, sender: row.sender === "organiser" ? "organiser" : "member", body: row.body || "", createdAt: row.created_at ?? null };
}

export function parseMessage(body, { max = 4000 } = {}) {
  const text = String(body?.body ?? "").trim();
  if (!text) throw invalid("Write a message first.");
  return text.slice(0, max);
}
