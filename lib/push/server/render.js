import { adminClient } from "@/lib/supabase/admin";
import { renderRow } from "./copy.js";

// Loads everything a batch of claimed rows needs in a handful of set queries, then renders each row.

const ids = (list) => [...new Set(list.filter((v) => typeof v === "string" && v))];

// Throws on a read error so the batch is retried, not rendered as "source missing" and skipped for good.
async function byId(sb, table, cols, list) {
  const keys = ids(list);
  if (!keys.length) return new Map();
  const { data, error } = await sb.from(table).select(cols).in("id", keys);
  if (error) throw new Error(`${table}: ${error.message}`);
  return new Map((data || []).map((r) => [r.id, r]));
}

const EVENT_COLS = "id, name, event_date, event_time, timezone, venue, address, city, organizer, metadata, deleted_at";

// rows -> Map(rowId -> { title, body, route, data, tz } | { skip } | { retry: error })
export async function renderBatch(rows) {
  try {
    return await renderLoaded(rows);
  } catch (e) {
    console.error("[push.render]", e);
    const msg = `Couldn't load source data: ${String(e?.message || e)}`.slice(0, 500);
    return new Map(rows.map((r) => [r.id, { retry: msg }]));
  }
}

async function renderLoaded(rows) {
  const sb = adminClient();
  const out = new Map();
  if (!sb || !rows.length) return out;
  const ref = (r, k) => r.ref?.[k];
  const chatTypes = new Set(["chat_reply", "chat_organiser_post", "qa_answer"]);

  const [orders, registrations, threads, announcements, memberships, meetings, rooms] = await Promise.all([
    byId(sb, "event_orders", "id, event_id, buyer_name, buyer_email, ticket_name, quantity, total, status, metadata, created_at", rows.map((r) => ref(r, "orderId"))),
    byId(sb, "registrations", "id, event_id, email, status, waitlist_position", rows.map((r) => ref(r, "registrationId"))),
    byId(sb, "portal_threads", "id, subject, event_id", rows.map((r) => ref(r, "threadId"))),
    byId(sb, "community_records", "id, name, config", rows.map((r) => ref(r, "announcementId"))),
    byId(sb, "membership_members", "id, status, expires_at, membership_id, plan:ticketing_records(name)", rows.map((r) => ref(r, "membershipMemberId"))),
    byId(sb, "meetings", "id, event_id, participants, starts_at, location_name, status", rows.map((r) => ref(r, "meetingId"))),
    byId(sb, "conference_records", "id, name, starts_at", rows.map((r) => ref(r, "roomId"))),
  ]);
  const [threadMessages, chatMessages, channels, checkins] = await Promise.all([
    byId(sb, "portal_thread_messages", "id, body", rows.filter((r) => r.type === "thread_reply").map((r) => ref(r, "messageId"))),
    byId(sb, "chat_messages", "id, author_name, body, deleted_at", rows.filter((r) => chatTypes.has(r.type)).map((r) => ref(r, "messageId"))),
    byId(sb, "chat_channels", "id, name, kind, event_id", rows.map((r) => ref(r, "channelId"))),
    byId(sb, "checkin_attendance", "id, checked_in_at", rows.map((r) => ref(r, "checkinId"))),
  ]);

  const eventIds = [
    ...rows.map((r) => r.event_id),
    ...[...orders.values()].map((o) => o.event_id),
    ...[...registrations.values()].map((g) => g.event_id),
    ...[...threads.values()].map((t) => t.event_id),
  ];
  const events = await byId(sb, "events", EVENT_COLS, eventIds);

  // Names for gift senders and meeting partners, plus member emails for the "covered by an order" check.
  const memberIds = [
    ...rows.map((r) => r.member_id),
    ...[...meetings.values()].flatMap((m) => m.participants || []),
  ];
  const members = await byId(sb, "portal_members", "id, email, name", memberIds);
  const organizerEmails = ids([...orders.values()].map((o) => String(o.metadata?.group?.organizer || "").toLowerCase()));
  const organizers = new Map();
  if (organizerEmails.length) {
    const { data, error } = await sb.from("portal_members").select("email, name").in("email", organizerEmails);
    if (error) throw new Error(`portal_members: ${error.message}`);
    for (const m of data || []) organizers.set(String(m.email).toLowerCase(), m.name);
  }

  for (const row of rows) {
    const order = orders.get(ref(row, "orderId")) || null;
    const registration = registrations.get(ref(row, "registrationId")) || null;
    const thread = threads.get(ref(row, "threadId")) || null;
    const event =
      events.get(row.event_id) || events.get(order?.event_id) || events.get(registration?.event_id) || events.get(thread?.event_id) || null;
    const ctx = { order, registration, thread, event };

    if (row.type === "ticket_gifted" && order) {
      const email = String(order.metadata?.group?.organizer || "").toLowerCase();
      ctx.organizerName = organizers.get(email) || email.split("@")[0] || "";
    }
    if (row.type === "refund_update") {
      ctx.currency = order?.metadata?.currency || event?.metadata?.currency || null;
    }
    if (row.type === "checked_in") ctx.checkedInAt = checkins.get(ref(row, "checkinId"))?.checked_in_at || null;
    if (row.type === "thread_reply") ctx.threadMessage = threadMessages.get(ref(row, "messageId")) || null;
    if (row.type === "announcement") ctx.announcement = announcements.get(ref(row, "announcementId")) || null;
    if (chatTypes.has(row.type)) {
      ctx.chatMessage = chatMessages.get(ref(row, "messageId")) || null;
      ctx.channel = channels.get(ref(row, "channelId")) || null;
    }
    if (row.type.startsWith("membership_")) {
      const m = memberships.get(ref(row, "membershipMemberId"));
      ctx.membership = m ? { ...m, planName: m.plan?.name || "" } : null;
    }
    if (row.type === "meeting_soon") {
      const m = meetings.get(ref(row, "meetingId")) || null;
      ctx.meeting = m;
      ctx.meetingOthers = (m?.participants || [])
        .filter((id) => id !== row.member_id)
        .map((id) => members.get(id)?.name || String(members.get(id)?.email || "").split("@")[0])
        .filter(Boolean);
    }
    if (row.type === "live_starting") ctx.room = rooms.get(ref(row, "roomId")) || null;
    if (row.type === "registration_update" && registration?.status === "Confirmed" && !row.ref?.previous) {
      ctx.coveredByOrder = await hasRecentOrder(sb, registration.event_id, members.get(row.member_id)?.email, row.created_at);
    }

    let rendered;
    try {
      rendered = renderRow(row, ctx);
    } catch (e) {
      console.error(`[push.render] ${row.type}`, e);
      rendered = { skip: "render" };
    }
    // Quiet hours are judged in the event's zone.
    out.set(row.id, rendered.skip ? rendered : { ...rendered, tz: event?.timezone || null });
  }
  return out;
}

// A paid checkout creates both an order and a registration; the order's confirmation already covers it.
async function hasRecentOrder(sb, eventId, email, around) {
  if (!eventId || !email) return false;
  const at = new Date(around || Date.now()).getTime();
  const { data } = await sb
    .from("event_orders")
    .select("id")
    .eq("event_id", eventId)
    .ilike("buyer_email", email.replace(/[\\%_]/g, "\\$&"))
    .gte("created_at", new Date(at - 15 * 60000).toISOString())
    .lte("created_at", new Date(at + 15 * 60000).toISOString())
    .limit(1);
  return Boolean(data?.length);
}
