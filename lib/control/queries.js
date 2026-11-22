import { selectAll } from "../supabase/select_all.js";
import { ORDER_COLUMNS, orderView, parseCursor, parseOrderFilter, searchTerm, threadView } from "./records.js";
import { must } from "./scope.js";
import { doorCounts } from "./stats.js";

// Reads shared by several Control routes; every one runs on the user-scoped client.

const ORDER_PAGE = 50;

// Orders newest first, filtered like the dashboard's status tabs, paged by a created_at cursor.
export async function listOrderPage(db, { projectId = null, eventId = null, filter, q, before }) {
  let query = db.from("event_orders").select(ORDER_COLUMNS);
  query = eventId ? query.eq("event_id", eventId) : query.eq("project_id", projectId);
  const status = parseOrderFilter(filter);
  if (status === "cancelled") query = query.not("cancelled_at", "is", null);
  if (status === "paid") query = query.is("cancelled_at", null).eq("refunded_total", 0);
  if (status === "refunded") query = query.is("cancelled_at", null).gt("refunded_total", 0);
  const term = searchTerm(q);
  if (term) query = query.or(`buyer_name.ilike.%${term}%,buyer_email.ilike.%${term}%,ticket_name.ilike.%${term}%`);
  const cursor = parseCursor(before);
  if (cursor) query = query.lt("created_at", cursor);
  const rows = must(await query.order("created_at", { ascending: false }).limit(ORDER_PAGE), "orders.list");

  const eventIds = [...new Set(rows.map((r) => r.event_id).filter(Boolean))];
  const events = new Map();
  if (eventIds.length) {
    const found = must(
      await db.from("events").select("id,name,currency:metadata->payments->>currency").in("id", eventIds),
      "orders.events",
    );
    for (const e of found) events.set(e.id, e);
  }
  return {
    orders: rows.map((r) => orderView(r, events.get(r.event_id)?.name || "", events.get(r.event_id)?.currency)),
    nextBefore: rows.length === ORDER_PAGE ? rows[rows.length - 1].created_at : null,
  };
}

// Every order row the figures need; past the 1,000-row API cap for big events.
export async function allOrderRows(db, { projectId = null, eventId = null, since = null }) {
  const build = () => {
    let query = db.from("event_orders").select("id,created_at,total,refunded_total,quantity,ticket_name,cancelled_at");
    query = eventId ? query.eq("event_id", eventId) : query.eq("project_id", projectId);
    if (since) query = query.gte("created_at", since);
    return query.order("created_at", { ascending: true }).order("id");
  };
  return must(await selectAll(build), "orders.all");
}

export async function countRows(db, table, apply) {
  const result = await apply(db.from(table).select("id", { count: "exact", head: true }));
  if (result.error) must(result, `${table}.count`);
  return result.count || 0;
}

// The project's conversations, newest activity first, with a last-message preview and the event's name.
export async function listThreads(db, projectId, { status = null } = {}) {
  // Each thread embeds only its newest message, so a busy conversation can't crowd out the others' previews.
  let query = db.from("portal_threads").select("*,portal_thread_messages(body,created_at)").eq("project_id", projectId);
  if (status) query = query.eq("status", status);
  const threads = must(
    await query
      .order("last_message_at", { ascending: false })
      .order("created_at", { referencedTable: "portal_thread_messages", ascending: false })
      .limit(1, { referencedTable: "portal_thread_messages" })
      .limit(200),
    "threads.list",
  );
  const eventIds = [...new Set(threads.map((t) => t.event_id).filter(Boolean))];
  const names = new Map();
  if (eventIds.length) {
    for (const e of must(await db.from("events").select("id,name").in("id", eventIds), "threads.events")) names.set(e.id, e.name);
  }
  return threads.map((t) =>
    threadView(t, { preview: t.portal_thread_messages?.[0]?.body || "", eventName: names.get(t.event_id) || "" }),
  );
}

// Seats and booths go back on sale when an order is cancelled or fully refunded; both are no-ops otherwise.
export async function releaseHolds(db, orderId) {
  const results = await Promise.all([
    db.rpc("release_order_seats", { p_order_id: orderId }),
    db.rpc("release_order_booths", { p_order_id: orderId }),
  ]);
  for (const result of results) if (result.error) console.error("[control.releaseHolds]", result.error.message);
}

// Who is inside and who is expected at the door, matching the dashboard's check-in header.
export async function loadDoorCounts(db, eventId) {
  const [registrations, orders, attendance] = await Promise.all([
    selectAll(() => db.from("registrations").select("id,email,status").eq("event_id", eventId).is("deleted_at", null).order("id")),
    selectAll(() =>
      db.from("event_orders").select("id,buyer_email,status,total,refunded_total,cancelled_at").eq("event_id", eventId).order("id"),
    ),
    selectAll(() =>
      db
        .from("checkin_attendance")
        .select("id,registration_id,order_id")
        .eq("event_id", eventId)
        .eq("status", "in")
        .is("session_id", null)
        .is("deleted_at", null)
        .order("id"),
    ),
  ]);
  return doorCounts(must(registrations, "door.registrations"), must(orders, "door.orders"), must(attendance, "door.attendance"));
}
