import { normalizeAnswers } from "../../forms/fields.js";
import { ApiError } from "../../staff_access/errors.js";
import { ticketCode } from "../records.js";

// View models and parsers for Control's money screens: refund requests, the ledger, disputes and enquiries.

export const REFUND_REQUEST_STATUSES = ["Requested", "Approved", "Denied", "Refunded"];
// "Refunded" is only ever reached by actually recording the refund, never set by hand.
export const SETTABLE_REQUEST_STATUSES = ["Requested", "Approved", "Denied"];
export const DISPUTE_STATUSES = ["Needs response", "Under review", "Won", "Lost"];
export const ENQUIRY_STATUSES = ["new", "contacted", "converted", "declined"];
// A sponsor enquiry is "converted" by filling a sponsorship spot on the dashboard, so the app can't set it.
export const SETTABLE_ENQUIRY_STATUSES = { packages: ["new", "contacted", "converted", "declined"], sponsors: ["new", "contacted", "declined"] };
export const LEDGER_TYPES = ["all", "charge", "refund"];
export const PAGE = 50;

const DATE = /^\d{4}-\d{2}-\d{2}$/;

function invalid(message) {
  return new ApiError("invalid_input", 400, message);
}

// A filter value from the query string, or null when it isn't one of the allowed ones.
export function pickFilter(value, allowed) {
  return allowed.includes(value) ? value : null;
}

const money = (n) => Math.round(Number(n ?? 0) * 100) / 100;
const currencyOf = (event) => String(event?.currency || "usd").toLowerCase();

export function refundRequestView(row, event = null) {
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    orderCode: ticketCode(row.order_id),
    eventId: row.event_id ?? null,
    eventName: event?.name ?? "",
    currency: currencyOf(event),
    name: row.buyer_name || "",
    email: row.buyer_email || "",
    reason: row.reason || "",
    amount: money(row.amount),
    status: row.status || "Requested",
    createdAt: row.created_at ?? null,
  };
}

export function parseRequestStatus(body) {
  const status = body?.status;
  if (!SETTABLE_REQUEST_STATUSES.includes(status)) throw invalid("Choose Requested, Approved or Denied.");
  return status;
}

// One ledger line per charge (an order) or refund, newest first across both, like the dashboard's Transactions.
export function chargeLine(order, event = null) {
  return {
    id: `c-${order.id}`,
    type: "charge",
    orderId: order.id,
    orderCode: ticketCode(order.id),
    name: order.buyer_name || "",
    email: order.buyer_email || "",
    ticket: order.ticket_name || "",
    eventName: event?.name ?? "",
    currency: currencyOf(event),
    amount: money(order.total),
    method: order.stripe_payment_intent_id ? "original" : "manual",
    at: order.created_at ?? null,
  };
}

export function refundLine(refund, order = null, event = null) {
  return {
    id: `r-${refund.id}`,
    type: "refund",
    orderId: refund.order_id ?? null,
    orderCode: ticketCode(refund.order_id),
    name: order?.buyer_name || "",
    email: order?.buyer_email || "",
    ticket: order?.ticket_name || "",
    eventName: event?.name ?? "",
    currency: currencyOf(event),
    amount: -money(refund.amount),
    method: refund.method || "original",
    at: refund.created_at ?? null,
  };
}

const time = (value) => {
  const ms = Date.parse(value ?? "");
  return Number.isNaN(ms) ? 0 : ms;
};

// Two newest-first pages merged into one; the cursor is the oldest line shown, so the next page starts just before it.
export function mergeLedger(charges, refunds, limit = PAGE) {
  const all = [...charges, ...refunds].sort((a, b) => time(b.at) - time(a.at) || String(b.id).localeCompare(String(a.id)));
  const items = all.slice(0, limit);
  const more = all.length > limit || charges.length >= limit || refunds.length >= limit;
  return { items, nextBefore: more && items.length ? items[items.length - 1].at : null };
}

export function disputeView(row, order = null, event = null) {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    orderCode: ticketCode(row.order_id),
    eventId: row.event_id ?? null,
    eventName: event?.name ?? "",
    currency: currencyOf(event),
    name: order?.buyer_name || "",
    email: order?.buyer_email || "",
    amount: money(row.amount),
    status: row.status || "Needs response",
    reason: row.reason || "",
    note: typeof meta.note === "string" ? meta.note : "",
    evidenceDueAt: row.evidence_due_at ?? null,
    createdAt: row.created_at ?? null,
  };
}

// Status, reason, evidence date and a private note; the note rides in metadata so other metadata keys survive.
export function parseDisputePatch(body, current) {
  if (!body || typeof body !== "object") throw invalid("Send the fields to change.");
  const patch = {};
  if ("status" in body) {
    if (!DISPUTE_STATUSES.includes(body.status)) throw invalid("That isn't a dispute status.");
    patch.status = body.status;
  }
  if ("reason" in body) {
    const reason = String(body.reason ?? "").trim();
    if (reason.length > 500) throw invalid("Keep the reason under 500 characters.");
    patch.reason = reason;
  }
  if ("evidenceDue" in body) {
    const due = String(body.evidenceDue ?? "").trim();
    if (due && (!DATE.test(due) || Number.isNaN(Date.parse(`${due}T00:00:00Z`)))) throw invalid("Evidence due must be YYYY-MM-DD.");
    patch.evidence_due_at = due ? `${due}T00:00:00Z` : null;
  }
  if ("note" in body) {
    const note = String(body.note ?? "").slice(0, 2000);
    const meta = current?.metadata && typeof current.metadata === "object" ? current.metadata : {};
    patch.metadata = { ...meta, note };
  }
  if (!Object.keys(patch).length) throw invalid("Send at least one field to change.");
  return patch;
}

export function packageEnquiryView(row, event = null) {
  return {
    id: row.id,
    kind: "packages",
    eventId: row.event_id ?? null,
    eventName: event?.name ?? "",
    title: [row.first_name, row.last_name].filter(Boolean).join(" ") || row.email || "Enquiry",
    subtitle: row.package_name || "",
    email: row.email || "",
    phone: row.phone || "",
    quantity: Number.isInteger(row.quantity) ? row.quantity : null,
    message: row.message || "",
    answers: [],
    status: row.status || "new",
    createdAt: row.created_at ?? null,
  };
}

export function sponsorEnquiryView(row, event = null) {
  return {
    id: row.id,
    kind: "sponsors",
    eventId: row.event_id ?? null,
    eventName: event?.name ?? "",
    title: row.company || row.contact_name || row.email || "Enquiry",
    subtitle: [row.spot_name, row.company ? row.contact_name : ""].filter(Boolean).join(" · "),
    email: row.email || "",
    phone: "",
    quantity: null,
    message: "",
    answers: normalizeAnswers(row.answers).map((a) => ({ label: a.label, value: typeof a.value === "boolean" ? (a.value ? "Yes" : "No") : String(a.value) })),
    status: row.status || "new",
    createdAt: row.created_at ?? null,
  };
}

export function parseEnquiryStatus(kind, body) {
  const allowed = SETTABLE_ENQUIRY_STATUSES[kind];
  if (!allowed) throw new ApiError("not_found", 404, "Not found.");
  if (!allowed.includes(body?.status)) {
    throw invalid(kind === "sponsors" && body?.status === "converted" ? "Convert a sponsor by filling a spot on the dashboard." : "That isn't an enquiry status.");
  }
  return body.status;
}
