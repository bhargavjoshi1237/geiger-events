// The order book: ~620 ticket orders across Halcyon's paid events, sold along a believable
// curve from each event's on-sale date, plus the refunds, disputes, refund requests, group
// purchases and timeline entries that hang off them. events.js derives sold/revenue from here.

import { EVENTS } from "./catalog.js";
import { GUESTS } from "./people.js";
import { PROJECT_ID, between, daysAgo, daysFromNow, hoursAgo, noise, pick, sid, weighted } from "./helpers.js";

const DAY = 864e5;

// One plan per paid ticket: which slice of the guest pool buys it and when.
function buildOrders() {
  const orders = [];
  let n = 0;
  EVENTS.forEach((def, ei) => {
    if (!def.tickets.length || def.status === "Draft") return;
    const eventAt = Date.now() + def.offset * DAY;
    const opensAt = eventAt - def.salesOpen * DAY;
    const closesAt = Math.min(Date.now() - 2 * 3600e3, eventAt - 6 * 3600e3);
    let buyer = ei * 61;
    def.tickets.forEach((ticket, ti) => {
      let remaining = ticket.sold;
      const early = /early/i.test(ticket.id);
      while (remaining > 0) {
        n += 1;
        const max = /team/.test(ticket.id) ? 1 : ticket.price >= 300 ? 2 : 5;
        const qty = Math.min(remaining, max === 1 ? 1 : weighted(n * 3, [[1, 62], [2, 24], [3, 7], [4, 5], [5, 2]].filter(([q]) => q <= max)));
        remaining -= qty;
        // Early-bird sells in the first quarter of the window; the rest ramps toward the date.
        const progress = early ? noise(n * 7) * 0.22 : Math.pow(noise(n * 7), 0.7);
        const at = opensAt + progress * (closesAt - opensAt);
        buyer = (buyer + 7 + (n % 3)) % GUESTS.length;
        const person = GUESTS[buyer];
        orders.push({ n, def, ticket, ti, qty, at, person });
      }
    });
  });
  return orders;
}

const PLAN = buildOrders();

const DISCOUNTS = [
  { code: "HALCYON15", percent: 15 },
  { code: "ALUMNI20", percent: 20 },
  { code: "TEAMLX", percent: 10 },
];

function lifecycle(n, def) {
  if (def.status === "Ended") {
    return weighted(n * 11, [["paid", 93], ["refunded", 4], ["partial", 2], ["cancelled", 1]]);
  }
  return weighted(n * 11, [["paid", 94], ["refunded", 2], ["partial", 2], ["cancelled", 2]]);
}

export const ORDER_ROWS = PLAN.map((plan) => {
  const { n, def, ticket, qty, at, person } = plan;
  const unit = ticket.price;
  const discount = unit > 0 && n % 9 === 0 ? pick(DISCOUNTS, n) : null;
  const gross = unit * qty;
  const discountAmount = discount ? Math.round(gross * discount.percent) / 100 : 0;
  const total = Math.round((gross - discountAmount) * 100) / 100;
  const state = total > 0 ? lifecycle(n, def) : "paid";
  const refunded = state === "refunded" ? total : state === "partial" ? Math.round(total * 0.5 * 100) / 100 : 0;
  const metadata = { tierId: ticket.id };
  if (discount) metadata.discount = { code: discount.code, percent: discount.percent, amount: discountAmount };
  if (/early/.test(ticket.id)) metadata.earlybird = { saved: 100 * qty };
  if (n % 23 === 0) metadata.note = pick(["Invoice to company — PO attached.", "Wheelchair space requested.", "Speaker's guest.", "Swapped from day pass."], n);
  return {
    id: sid("order", n),
    event_id: def.id,
    project_id: PROJECT_ID,
    buyer_name: person.name,
    buyer_email: person.email,
    ticket_name: ticket.name,
    ticket_price: unit,
    quantity: qty,
    total,
    refunded_total: refunded,
    status: state === "refunded" ? "refunded" : state === "cancelled" ? "cancelled" : "confirmed",
    cancelled_at: state === "cancelled" ? new Date(Math.min(at + 2 * DAY, Date.now() - 3600e3)).toISOString() : null,
    stripe_session_id: total > 0 ? `cs_live_${sid("order", n).replace(/-/g, "").slice(0, 24)}` : null,
    stripe_payment_intent_id: total > 0 && n % 17 !== 0 ? `pi_3Q${sid("order", n).replace(/-/g, "").slice(8, 30)}` : null,
    stripe_payment_details: null,
    metadata,
    created_at: new Date(at).toISOString(),
  };
});

export const ORDER_PLAN = PLAN;

// Sold tickets and gross revenue per event and per ticket id, net of cancellations and refunds.
export const TALLIES = (() => {
  const byEvent = {};
  ORDER_ROWS.forEach((row, i) => {
    const plan = PLAN[i];
    const t = (byEvent[row.event_id] ??= { sold: 0, revenue: 0, ticketSold: {} });
    if (row.cancelled_at || row.status === "refunded") return;
    t.sold += row.quantity;
    t.revenue += row.total - row.refunded_total;
    t.ticketSold[plan.ticket.id] = (t.ticketSold[plan.ticket.id] ?? 0) + row.quantity;
  });
  return byEvent;
})();

const REASONS = [
  ["requested_by_customer", "Can no longer attend — travel cancelled."],
  ["duplicate", "Bought twice by mistake."],
  ["requested_by_customer", "Switched to a day pass."],
  ["other", "Company covering the ticket instead."],
  ["requested_by_customer", "Illness."],
];

export function ordersSeed() {
  const order_refunds = [];
  const order_events = [];
  let ev = 0;
  let rf = 0;

  ORDER_ROWS.forEach((row, i) => {
    const created = Date.parse(row.created_at);
    order_events.push({ id: sid("orderEvent", ++ev), order_id: row.id, project_id: PROJECT_ID, type: "created", summary: `${row.quantity} × ${row.ticket_name}`, amount: row.total, actor: row.buyer_name, metadata: {}, created_at: row.created_at });
    if (i % 4 === 0) {
      order_events.push({ id: sid("orderEvent", ++ev), order_id: row.id, project_id: PROJECT_ID, type: "receipt_sent", summary: `Receipt emailed to ${row.buyer_email}`, amount: null, actor: "Geiger Events", metadata: {}, created_at: new Date(created + 60e3).toISOString() });
    }
    if (row.refunded_total > 0) {
      const [code, reason] = pick(REASONS, i);
      const at = new Date(Math.min(created + between(i, 2, 9) * DAY, Date.now() - 3600e3)).toISOString();
      rf += 1;
      order_refunds.push({
        id: sid("orderRefund", rf), order_id: row.id, event_id: row.event_id, project_id: PROJECT_ID,
        amount: row.refunded_total, reason, reason_code: code, method: i % 5 === 0 ? "credit" : "original",
        status: "Issued", notes: "", created_by: null, metadata: {}, created_at: at, updated_at: at, deleted_at: null,
      });
      order_events.push({ id: sid("orderEvent", ++ev), order_id: row.id, project_id: PROJECT_ID, type: "refund_issued", summary: `Refunded ${row.refunded_total.toFixed(2)}`, amount: row.refunded_total, actor: "Maya Chen", metadata: { reasonCode: code }, created_at: at });
    }
    if (row.cancelled_at) {
      order_events.push({ id: sid("orderEvent", ++ev), order_id: row.id, project_id: PROJECT_ID, type: "cancelled", summary: "Order cancelled", amount: null, actor: "Tomás Silva", metadata: {}, created_at: row.cancelled_at });
    }
  });

  // A handful of refunds still waiting on a decision.
  const open = ORDER_ROWS.filter((r) => r.status === "confirmed" && r.total > 100).slice(0, 40).filter((_, i) => i % 8 === 3);
  open.forEach((row, i) => {
    rf += 1;
    const [code, reason] = pick(REASONS, i + 2);
    order_refunds.push({
      id: sid("orderRefund", rf), order_id: row.id, event_id: row.event_id, project_id: PROJECT_ID,
      amount: row.total, reason, reason_code: code, method: "original", status: i % 2 ? "Approved" : "Requested",
      notes: i % 2 ? "Approved — process after the transfer window." : "", created_by: null, metadata: {},
      created_at: hoursAgo(6 + i * 19), updated_at: hoursAgo(4 + i * 19), deleted_at: null,
    });
  });

  const disputeOrders = ORDER_ROWS.filter((r) => r.status === "confirmed" && r.total >= 190).filter((_, i) => i % 41 === 5).slice(0, 6);
  const disputeStatus = ["Needs response", "Needs response", "Under review", "Won", "Lost", "Under review"];
  const disputeReason = ["fraudulent", "product_not_received", "duplicate", "fraudulent", "subscription_canceled", "unrecognized"];
  const order_disputes = disputeOrders.map((row, i) => ({
    id: sid("dispute", i + 1), order_id: row.id, event_id: row.event_id, project_id: PROJECT_ID, amount: row.total,
    status: disputeStatus[i], reason: disputeReason[i], evidence_due_at: daysFromNow([3, 6, 9, -14, -21, 12][i]),
    metadata: { network: i % 2 ? "mastercard" : "visa" }, created_at: daysAgo([4, 2, 7, 30, 41, 1][i]), updated_at: daysAgo([1, 1, 3, 12, 20, 0][i]), deleted_at: null,
  }));
  disputeOrders.forEach((row, i) => {
    order_events.push({ id: sid("orderEvent", ++ev), order_id: row.id, project_id: PROJECT_ID, type: "disputed", summary: `Chargeback opened (${disputeReason[i]})`, amount: row.total, actor: "Stripe", metadata: {}, created_at: order_disputes[i].created_at });
  });

  const requestRows = ORDER_ROWS.filter((r) => r.status === "confirmed" && r.total > 0).filter((_, i) => i % 53 === 11).slice(0, 9);
  const requestStatus = ["Requested", "Requested", "Requested", "Approved", "Denied", "Refunded", "Requested", "Approved", "Denied"];
  const refund_requests = requestRows.map((row, i) => ({
    id: sid("refundRequest", i + 1), project_id: PROJECT_ID, event_id: row.event_id, order_id: row.id,
    buyer_name: row.buyer_name, buyer_email: row.buyer_email, reason: pick(REASONS, i + 1)[1], amount: row.total,
    status: requestStatus[i], metadata: {}, created_at: hoursAgo(3 + i * 26), updated_at: hoursAgo(2 + i * 26), deleted_at: null,
  }));
  requestRows.forEach((row, i) => {
    order_events.push({ id: sid("orderEvent", ++ev), order_id: row.id, project_id: PROJECT_ID, type: "refund_requested", summary: "Buyer requested a refund from the portal", amount: row.total, actor: row.buyer_name, metadata: {}, created_at: refund_requests[i].created_at });
  });

  const summit = EVENTS[0];
  const groups = [
    ["Fieldnote Press", 8, "Confirmed"], ["Northbound Agency", 12, "Confirmed"], ["Lumio Labs", 6, "Pending"],
    ["Tidal Digital", 10, "Confirmed"], ["Studio Ondas", 5, "Cancelled"], ["Brightwater Studio", 7, "Pending"],
  ];
  const group_purchases = groups.map(([company, seats, status], i) => {
    const lead = GUESTS.find((g) => g.company === company) ?? GUESTS[i * 9];
    return {
      id: sid("groupPurchase", i + 1), project_id: PROJECT_ID, event_id: summit.id, organizer_name: lead.name, organizer_email: lead.email,
      seats, total: seats * 390 * 0.85, code: `GRP-${company.replace(/[^A-Z]/g, "").slice(0, 3)}${seats}`, status,
      metadata: { company, discountPercent: 15 }, created_at: daysAgo(40 - i * 5), updated_at: daysAgo(30 - i * 4), deleted_at: null,
    };
  });

  return { event_orders: ORDER_ROWS, order_events, order_refunds, order_disputes, refund_requests, group_purchases };
}
