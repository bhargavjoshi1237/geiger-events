import { normalizeSpec, matchesFilters, poolFromOrders } from "@/lib/audience/resolve";

// Pure board-visibility check for ONE member, mirroring the dashboard's audience picker semantics:
// event boards reach that event's ticket holders, community boards reach anyone tied to the project, and a
// filtered audience narrows either by ticket / offering / add-on / tag / status / segment / named people.

const lc = (s) => String(s || "").trim().toLowerCase();

export function isValidOrder(o) {
  const status = lc(o?.status);
  return !o?.cancelled_at && status !== "cancelled" && status !== "refunded";
}

// event_orders row -> the normalized order shape poolFromOrders expects.
export function orderForPool(row) {
  const meta = row?.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    email: row?.buyer_email ?? "",
    name: row?.buyer_name ?? "",
    ticket: row?.ticket_name ?? "",
    offerings: meta.offerings ?? null,
    purchasables: meta.purchasables ?? null,
  };
}

// The member as a guest of one project (tags/status/segment inputs), or null when they have no contact row.
export function guestFor({ email, name, contact, registrationEventIds = [] }) {
  return {
    email: lc(email),
    name: name || contact?.name || "",
    status: contact?.status || null,
    tags: contact?.tags || [],
    contact: contact || null,
    eventIds: registrationEventIds,
  };
}

export function boardSpec(board) {
  return normalizeSpec(board?.audience, { fallbackEventId: board?.event_id || "" });
}

export function specIsFiltered(board) {
  return boardSpec(board).mode === "filtered";
}

// ctx: { email, ordersByEvent: Map<eventId, row[]>, guestByProject: Map<projectId, guest>, segmentsByProject }
export function boardVisibleTo(board, ctx) {
  if (!board || board.deleted_at || board.archived) return false;
  const email = lc(ctx.email);
  const spec = boardSpec(board);
  if (spec.exclude.includes(email)) return false;
  if (spec.include.includes(email)) return true;

  const eventId = board.event_id || (spec.scope === "event" ? spec.eventId : "");
  const guest = ctx.guestByProject?.get(board.project_id) || null;
  const segCtx = {
    attendingEmails: new Set(guest?.eventIds?.length ? [email] : []),
    eventsByEmail: new Map([[email, guest?.eventIds || []]]),
  };
  const segments = ctx.segmentsByProject?.get(board.project_id) || [];

  if (eventId) {
    const orders = (ctx.ordersByEvent?.get(eventId) || []).filter(isValidOrder);
    if (!orders.length) return false;
    if (spec.mode === "all") return true;
    const guestByEmail = new Map(guest ? [[email, guest]] : []);
    const { pool } = poolFromOrders(orders.map(orderForPool), guestByEmail);
    const person = pool.find((p) => p.email === email);
    return Boolean(person && matchesFilters(person, spec.filters, { segments, ctx: segCtx }));
  }

  if (spec.mode === "all") return true;
  if (!guest) return false;
  const person = {
    email,
    name: guest.name,
    tickets: new Set(),
    offeringKeys: new Set(),
    purchasableKeys: new Set(),
    status: guest.status,
    tags: guest.tags,
    contact: guest.contact,
  };
  return matchesFilters(person, spec.filters, { segments, ctx: segCtx });
}
