import { adminClient } from "@/lib/supabase/admin";
import { resolveItemGrant } from "@/lib/live/access";
import { resolveRoomState } from "@/lib/live/state";
import { buildMemberGrants, GRANT_EVENT_COLS, GRANT_MEMBER_COLS } from "@/lib/portal/grants";
import { selectAll } from "@/lib/supabase/select_all";
import { AHEAD_MS, GRACE_MS, dueEventOffsets, eventReminderRows, liveRoomRows, meetingReminderRows, membershipReminderRows } from "./plan_rules.js";
import { enqueueRows, getProjectSettingsMap, getRuntime, logRun, pushDb } from "./store.js";

// Every 5 min (pg_cron): queue reminders that fall due soon, release scheduled announcements, trim old history.

const ROOM_MODULES = ["room", "webinar", "breakout"];
const lc = (s) => String(s || "").trim().toLowerCase();
const isoDay = (d) => d.toISOString().slice(0, 10);

// lower(email) -> portal member id, matched case-insensitively in SQL.
async function membersByEmail(sb, emails) {
  const list = [...new Set(emails.map(lc).filter(Boolean))];
  const map = new Map();
  const db = pushDb();
  for (let i = 0; i < list.length && db; i += 500) {
    const { data, error } = await db.rpc("members_by_emails", { p_emails: list.slice(i, i + 500) });
    if (error) console.error("[push.plan.members]", error.message);
    for (const m of data || []) map.set(lc(m.email), m.id);
  }
  return map;
}

async function planEvents(sb, now) {
  const { data: events, error } = await sb
    .from("events")
    .select("id, project_id, name, status, event_date, event_time, timezone")
    .gte("event_date", isoDay(new Date(now.getTime() - 86400000)))
    .lte("event_date", isoDay(new Date(now.getTime() + 15 * 86400000)))
    .not("status", "in", "(Draft,Ended,Cancelled)")
    .is("deleted_at", null);
  if (error) {
    console.error("[push.plan.events]", error.message);
    return [];
  }
  const settings = await getProjectSettingsMap((events || []).map((e) => e.project_id));
  const rows = [];
  for (const event of events || []) {
    const { start, due } = dueEventOffsets(event, settings.get(event.project_id).eventOffsets, now);
    if (!due.length) continue;
    const [orders, regs] = await Promise.all([
      selectAll(() => sb.from("event_orders").select("id, buyer_email, status, created_at").eq("event_id", event.id).is("cancelled_at", null).order("created_at").order("id")),
      selectAll(() => sb.from("registrations").select("id, email").eq("event_id", event.id).in("status", ["Confirmed", "Checked-in"]).is("deleted_at", null).order("id")),
    ]);
    if (orders.error || regs.error) throw new Error((orders.error || regs.error).message);
    // One reminder per person; ticket holders deep-link to their first order's pass.
    const orderByEmail = new Map();
    for (const o of orders.data || []) {
      if (!["confirmed", "paid"].includes(o.status || "confirmed")) continue;
      if (!orderByEmail.has(lc(o.buyer_email))) orderByEmail.set(lc(o.buyer_email), o.id);
    }
    const emails = [...orderByEmail.keys(), ...(regs.data || []).map((r) => lc(r.email))];
    const members = await membersByEmail(sb, emails);
    const holders = [];
    const seen = new Set();
    for (const email of emails) {
      const memberId = members.get(email);
      if (!memberId || seen.has(memberId)) continue;
      seen.add(memberId);
      holders.push({ memberId, orderId: orderByEmail.get(email) || null });
    }
    for (const offset of due) rows.push(...eventReminderRows(event, start, offset, holders));
  }
  return rows;
}

async function planMeetings(sb, now) {
  const { data, error } = await sb
    .from("meetings")
    .select("id, project_id, event_id, participants, starts_at, status")
    .eq("status", "scheduled")
    .is("deleted_at", null)
    .gte("starts_at", new Date(now.getTime() - GRACE_MS + 10 * 60000).toISOString())
    .lt("starts_at", new Date(now.getTime() + AHEAD_MS + 10 * 60000).toISOString());
  if (error) {
    console.error("[push.plan.meetings]", error.message);
    return [];
  }
  return (data || []).flatMap((m) => meetingReminderRows(m, now));
}

async function planMemberships(sb, now) {
  const { data, error } = await selectAll(() =>
    sb
      .from("membership_members")
      .select("id, project_id, email, status, expires_at")
      .eq("status", "Active")
      .is("deleted_at", null)
      .gte("expires_at", new Date(now.getTime() - 86400000).toISOString())
      .lte("expires_at", new Date(now.getTime() + 61 * 86400000).toISOString())
      .order("id"),
  );
  if (error) {
    console.error("[push.plan.memberships]", error.message);
    return [];
  }
  const settings = await getProjectSettingsMap((data || []).map((m) => m.project_id));
  const members = await membersByEmail(sb, (data || []).map((m) => m.email));
  return (data || []).flatMap((m) =>
    membershipReminderRows(m, members.get(lc(m.email)), settings.get(m.project_id).membershipDays, now),
  );
}

// Live rooms are a membership benefit: notify active members whose plan grants the room, using the portal's own rules.
async function planLiveRooms(sb, now) {
  const { data: rooms, error } = await sb
    .from("conference_records")
    .select("id, project_id, module, config, starts_at, ends_at")
    .in("module", ROOM_MODULES)
    .is("deleted_at", null)
    .gte("starts_at", new Date(now.getTime() - GRACE_MS).toISOString())
    .lt("starts_at", new Date(now.getTime() + AHEAD_MS).toISOString());
  if (error) {
    console.error("[push.plan.live]", error.message);
    return [];
  }
  const rows = [];
  for (const room of rooms || []) {
    const config = room.config && typeof room.config === "object" ? room.config : {};
    if (resolveRoomState({ startsAt: room.starts_at, endsAt: room.ends_at, config }, now.getTime()).state === "Ended") continue;
    const [holdersRes, eventsRes] = await Promise.all([
      selectAll(() => sb.from("membership_members").select(GRANT_MEMBER_COLS).eq("project_id", room.project_id).eq("status", "Active").is("deleted_at", null).order("id")),
      selectAll(() => sb.from("events").select(GRANT_EVENT_COLS).eq("project_id", room.project_id).is("deleted_at", null).order("id")),
    ]);
    if (holdersRes.error || eventsRes.error) throw new Error((holdersRes.error || eventsRes.error).message);
    const holders = holdersRes.data;
    const eventRows = eventsRes.data;
    const byEmail = new Map();
    for (const h of holders || []) (byEmail.get(lc(h.email)) || byEmail.set(lc(h.email), []).get(lc(h.email))).push(h);
    const eventIds = Array.isArray(config.eventIds) ? config.eventIds.filter(Boolean) : config.eventId ? [config.eventId] : [];
    const entitled = [];
    for (const [email, list] of byEmail) {
      const prepared = buildMemberGrants(list, eventRows || []);
      if (!prepared) continue;
      const grant = resolveItemGrant({ access: config.access, eventIds, projectId: room.project_id, ...prepared });
      if (grant.granted && !(grant.expiresAt && new Date(grant.expiresAt).getTime() <= now.getTime())) entitled.push(email);
    }
    const members = await membersByEmail(sb, entitled);
    rows.push(...liveRoomRows(room, [...new Set(members.values())]));
  }
  return rows;
}

// "Scheduled" announcements go out once config.scheduledFor passes; flipping to Sent fires the fan-out trigger.
async function releaseScheduledAnnouncements(sb, now) {
  const { data, error } = await sb
    .from("community_records")
    .select("id, config")
    .eq("module", "announcement")
    .eq("status", "Scheduled")
    .is("deleted_at", null)
    .limit(500);
  if (error) {
    console.error("[push.plan.announcements]", error.message);
    return 0;
  }
  let released = 0;
  for (const r of data || []) {
    const when = new Date(r.config?.scheduledFor);
    if (Number.isNaN(when.getTime()) || when > now) continue;
    const { error: upErr } = await sb.from("community_records").update({ status: "Sent" }).eq("id", r.id).eq("status", "Scheduled");
    if (!upErr) released += 1;
  }
  return released;
}

async function housekeeping(db, now) {
  const day = 86400000;
  await Promise.all([
    db.from("dispatch_runs").delete().lt("started_at", new Date(now.getTime() - 14 * day).toISOString()),
    db.from("fanouts").delete().neq("status", "pending").lt("created_at", new Date(now.getTime() - 30 * day).toISOString()),
    db.from("notifications").delete().lt("created_at", new Date(now.getTime() - 180 * day).toISOString()),
  ]);
}

export async function runPlan({ now = new Date() } = {}) {
  const started = Date.now();
  const sb = adminClient();
  const db = pushDb();
  if (!sb || !db) return { ok: false, error: "unavailable" };
  if (process.env.PUSH_DISPATCH_PAUSED === "1" || (await getRuntime()).paused) return { ok: true, paused: true };
  const stats = { planned: 0 };
  try {
    const parts = await Promise.allSettled([planEvents(sb, now), planMeetings(sb, now), planMemberships(sb, now), planLiveRooms(sb, now)]);
    const rows = [];
    for (const p of parts) {
      if (p.status === "fulfilled") rows.push(...p.value);
      else console.error("[push.plan]", p.reason);
    }
    stats.planned = await enqueueRows(rows);
    stats.released = await releaseScheduledAnnouncements(sb, now);
    await housekeeping(db, now);
  } catch (e) {
    console.error("[push.plan]", e);
    stats.error = String(e?.message || e);
  }
  await logRun("plan", started, stats);
  return { ok: !stats.error, ...stats, ms: Date.now() - started };
}
