import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

import { PUSH_TYPES } from "../lib/push/types.js";

// Isolated PGlite check of 20261122100000_events_push.sql: every capture trigger, dedupe, supersede, claim/lease,
// enqueue_rows and the service-role-only grants. Set PGLITE_MODULE to an installed @electric-sql/pglite dist/index.js.
const runtime = process.env.PGLITE_MODULE;
if (!runtime) throw new Error("Set PGLITE_MODULE to an installed @electric-sql/pglite dist/index.js");
const { PGlite } = await import(pathToFileURL(runtime).href);
const db = new PGlite();

let assertions = 0;
const ok = (value, message) => { assert.ok(value, message); assertions++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const all = async (sql, values = []) => (await db.query(sql, values)).rows;
const tx = async (fn) => db.transaction(fn);

await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema events; create schema auth;
  create table public.projects(id uuid primary key);
  create function events.touch_updated_at() returns trigger language plpgsql as $$ begin new.updated_at = now(); return new; end $$;
  create table events.portal_members(id uuid primary key default gen_random_uuid(), email text not null, name text not null default '', metadata jsonb default '{}', created_at timestamptz default now());
  create unique index on events.portal_members (lower(email));
  create table events.portal_devices(id uuid primary key default gen_random_uuid(), member_id uuid not null, push_token text not null unique, platform text not null default 'unknown',
    app_version text, last_seen_at timestamptz not null default now(), metadata jsonb not null default '{}', created_by uuid, created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(), deleted_at timestamptz);
  create table events.events(id uuid primary key default gen_random_uuid(), project_id uuid, name text, status text default 'On Sale', event_date date, event_time text,
    timezone text default 'Europe/London', venue text, address text, city text, deleted_at timestamptz);
  create table events.event_orders(id uuid primary key default gen_random_uuid(), event_id uuid, project_id uuid, buyer_name text default '', buyer_email text default '',
    ticket_name text default 'GA', quantity int default 1, total numeric default 0, status text default 'confirmed', metadata jsonb default '{}', cancelled_at timestamptz, created_at timestamptz default now());
  create table events.registrations(id uuid primary key default gen_random_uuid(), event_id uuid, project_id uuid, name text default '', email text default '', status text default 'Confirmed',
    source text default 'Online', waitlist_position int, deleted_at timestamptz);
  create table events.refund_requests(id uuid primary key default gen_random_uuid(), project_id uuid, event_id uuid, order_id uuid, buyer_email text default '', amount numeric default 0,
    status text default 'Requested', deleted_at timestamptz);
  create table events.order_refunds(id uuid primary key default gen_random_uuid(), order_id uuid, event_id uuid, project_id uuid, amount numeric default 0, status text default 'Requested', deleted_at timestamptz);
  create table events.checkin_attendance(id uuid primary key default gen_random_uuid(), event_id uuid, project_id uuid, registration_id uuid, order_id uuid, gate text, status text default 'in',
    checked_in_at timestamptz default now(), deleted_at timestamptz);
  create table events.portal_threads(id uuid primary key default gen_random_uuid(), member_id uuid not null, project_id uuid, event_id uuid, subject text default '');
  create table events.portal_thread_messages(id uuid primary key default gen_random_uuid(), thread_id uuid not null, sender text default 'member', body text default '');
  create table events.community_records(id uuid primary key default gen_random_uuid(), project_id uuid, module text, name text, status text default 'Draft', config jsonb default '{}', deleted_at timestamptz);
  create table events.chat_channels(id uuid primary key default gen_random_uuid(), project_id uuid, event_id uuid, kind text default 'event', name text default '', posting_mode text default 'announce',
    status text default 'active', metadata jsonb default '{}', deleted_at timestamptz);
  create table events.chat_participants(id uuid primary key default gen_random_uuid(), channel_id uuid, member_id uuid, user_id uuid, role text default 'member', muted boolean default false);
  create unique index chat_participants_member_uidx on events.chat_participants (channel_id, member_id) where member_id is not null;
  create table events.chat_messages(id uuid primary key default gen_random_uuid(), channel_id uuid, author_member_id uuid, author_user_id uuid, sender_kind text default 'member',
    author_name text default '', body text default '', metadata jsonb default '{}', deleted_at timestamptz);
  create table events.enrol_log(event_id uuid, email text);
  create function events.add_ticket_buyer_to_chat(p_event_id uuid, p_email text, p_name text default '') returns void language sql as $$ insert into events.enrol_log values (p_event_id, p_email) $$;
`);

const project = randomUUID();
const legacyMember = randomUUID();
await db.query("insert into events.portal_devices(member_id, push_token) values ($1, 'ExponentPushToken[legacy]')", [legacyMember]);

const migration = await readFile(new URL("../supabase/migrations/20261122100000_events_push.sql", import.meta.url), "utf8");
await db.exec(migration.split("-- @up")[1].split("-- @down")[0]);

const member = async (email) => (await one("insert into events.portal_members(email, name) values ($1, $2) returning id", [email, email.split("@")[0]])).id;
const rows = async (type) => all("select * from events_push.notifications where type = $1 order by created_at, id", [type]);
const today = new Date();
const inDays = (n) => new Date(today.getTime() + n * 86400000).toISOString().slice(0, 10);

// Catalog parity: SQL categories match lib/push/types.js.
for (const t of PUSH_TYPES) eq((await one("select events_push.category_of($1) as c", [t.key])).c, t.category, `category_of(${t.key})`);

// Legacy devices carried over.
eq((await one("select count(*)::int as n from events_push.devices where push_token = 'ExponentPushToken[legacy]'")).n, 1, "devices copied");

const ada = await member("ada@example.com");
const event = (await one("insert into events.events(project_id, name, event_date, event_time, venue, city) values ($1, 'Finals', $2, '19:00', 'Hall', 'London') returning id", [project, inDays(10)])).id;

// Orders: deferred trigger sees the member created later in the same transaction (buy_ticket order).
const grace = await tx(async (t) => {
  const o = (await t.query("insert into events.event_orders(event_id, project_id, buyer_email, buyer_name) values ($1, $2, 'Grace@Example.com', 'Grace') returning id", [event, project])).rows[0].id;
  await t.query("insert into events.portal_members(email, name) values ('grace@example.com', 'Grace')");
  return o;
});
let confirmed = await rows("order_confirmed");
eq(confirmed.length, 1, "order_confirmed for a buyer created after the order");
eq(confirmed[0].ref.orderId, grace, "ref carries the order");
eq(confirmed[0].category, "tickets", "category stamped");
eq(confirmed[0].project_id, project, "project stamped");
ok((await one("select count(*)::int as n from events.enrol_log where event_id = $1", [event])).n === 1, "chat enrolment restored");

// Pending -> confirmed sends once; re-saving doesn't resend.
const pending = (await one("insert into events.event_orders(event_id, project_id, buyer_email, status) values ($1, $2, 'ada@example.com', 'pending') returning id", [event, project])).id;
eq((await rows("order_confirmed")).length, 1, "pending order is quiet");
await db.query("update events.event_orders set status = 'paid' where id = $1", [pending]);
await db.query("update events.event_orders set status = 'confirmed' where id = $1", [pending]);
eq((await rows("order_confirmed")).length, 2, "confirmed once on payment");

// Group booking: guest gets ticket_gifted, a non-attending organiser gets one group confirmation.
const boss = await member("boss@example.com");
const guest = await member("guest@example.com");
await db.query(
  "insert into events.event_orders(event_id, project_id, buyer_email, metadata) values ($1, $2, 'guest@example.com', $3)",
  [event, project, { group: { id: "g1", size: 2, index: 0, organizer: "boss@example.com" } }],
);
eq((await rows("ticket_gifted")).map((r) => r.member_id), [guest], "guest gets ticket_gifted");
ok((await rows("order_confirmed")).some((r) => r.member_id === boss && r.ref.organizer === true), "organiser gets the group confirmation");

// Cancel.
await db.query("update events.event_orders set cancelled_at = now() where id = $1", [pending]);
eq((await rows("order_cancelled")).length, 1, "order_cancelled");

// Unknown buyer: no row, no error.
await db.query("insert into events.event_orders(event_id, project_id, buyer_email) values ($1, $2, 'nobody@example.com')", [event, project]);
eq((await rows("order_confirmed")).length, 3, "no row for an email without an account");

// Refunds: request decisions and issued refunds share the per-order 10-minute "done" key.
const req = (await one("insert into events.refund_requests(project_id, event_id, order_id, buyer_email) values ($1, $2, $3, 'grace@example.com') returning id", [project, event, grace])).id;
await db.query("update events.refund_requests set status = 'Approved' where id = $1", [req]);
await db.query("update events.refund_requests set status = 'Refunded' where id = $1", [req]);
await db.query("insert into events.order_refunds(order_id, event_id, project_id, amount, status) values ($1, $2, $3, 10, 'Issued')", [grace, event, project]);
eq((await rows("refund_update")).map((r) => r.ref.status), ["Approved", "Refunded"], "approved + one refund-done");

// Registrations.
const reg = (await one("insert into events.registrations(event_id, project_id, email, status, waitlist_position) values ($1, $2, 'ada@example.com', 'Waitlisted', 4) returning id", [event, project])).id;
await db.query("update events.registrations set status = 'Confirmed', waitlist_position = null where id = $1", [reg]);
const regRows = await rows("registration_update");
eq(regRows.map((r) => [r.ref.status, r.ref.previous]), [["Waitlisted", null], ["Confirmed", "Waitlisted"]], "waitlisted then promoted");
await db.query("insert into events.registrations(event_id, project_id, email, status) values ($1, $2, 'ada@example.com', 'Confirmed')", [event, project]);
const delayed = (await rows("registration_update")).at(-1);
ok(new Date(delayed.send_after) > new Date(Date.now() + 60000), "plain registration waits for an order to cover it");
await db.query("insert into events.registrations(event_id, project_id, email, status, source) values ($1, $2, 'ada@example.com', 'Confirmed', 'Import')", [event, project]);
eq((await rows("registration_update")).length, 3, "imports stay quiet");

// Check-ins: once per attendee per day.
await db.query("insert into events.checkin_attendance(event_id, project_id, order_id, gate) values ($1, $2, $3, 'North')", [event, project, grace]);
await db.query("insert into events.checkin_attendance(event_id, project_id, order_id) values ($1, $2, $3)", [event, project, grace]);
const checks = await rows("checked_in");
eq(checks.length, 1, "re-entry doesn't repeat");
ok(checks[0].expires_at, "check-in alert expires");

// Event edits: delayed, and a second edit supersedes the first.
await db.query("update events.events set venue = 'Arena' where id = $1", [event]);
await db.query("update events.events set event_time = '20:00' where id = $1", [event]);
const changes = await rows("event_changed");
const holders = new Set(changes.map((r) => r.member_id));
ok(holders.has(ada) && holders.has(guest), "holders notified");
eq(changes.filter((r) => r.status === "queued").every((r) => r.ref.changed.includes("time")), true, "newest edit is the queued one");
ok(changes.some((r) => r.status === "skipped" && r.skip_reason === "superseded"), "older edit superseded");
await db.query("update events.events set name = 'Finals 2026' where id = $1", [event]);
eq((await rows("event_changed")).length, changes.length, "name-only edits don't notify");
// Going back to an earlier venue is still news (keys are per change, not per content).
await db.query("update events.events set venue = 'Hall' where id = $1", [event]);
await db.query("update events.events set venue = 'Arena' where id = $1", [event]);
const latest = (await rows("event_changed")).filter((r) => r.status === "queued");
eq(latest.length, holders.size, "a reverted venue queues again, one per holder");
ok(latest.every((r) => r.ref.changed.includes("venue")), "queued row is the latest edit");

// Drafts stay quiet; cancelling notifies holders.
const draft = (await one("insert into events.events(project_id, name, status, event_date) values ($1, 'D', 'Draft', $2) returning id", [project, inDays(5)])).id;
await db.query("update events.events set venue = 'X' where id = $1", [draft]);
eq((await all("select 1 from events_push.notifications where event_id = $1", [draft])).length, 0, "draft edits quiet");
await db.query("update events.events set deleted_at = now() where id = $1", [event]);
ok((await rows("event_cancelled")).length >= 2, "cancellation reaches holders");

// Threads: organiser replies only, delayed and superseding within the thread.
const thread = (await one("insert into events.portal_threads(member_id, project_id, subject) values ($1, $2, 'Parking') returning id", [ada, project])).id;
await db.query("insert into events.portal_thread_messages(thread_id, sender, body) values ($1, 'member', 'hi')", [thread]);
await db.query("insert into events.portal_thread_messages(thread_id, sender, body) values ($1, 'organiser', 'one')", [thread]);
await db.query("insert into events.portal_thread_messages(thread_id, sender, body) values ($1, 'organiser', 'two')", [thread]);
const replies = await rows("thread_reply");
eq(replies.map((r) => r.status), ["skipped", "queued"], "member messages quiet; quick replies collapse");

// Announcements become one fan-out row, once.
const ann = (await one("insert into events.community_records(project_id, module, name, status, config) values ($1, 'announcement', 'Doors', 'Draft', $2) returning id", [project, { audience: { eventId: "not-a-uuid" } }])).id;
await db.query("update events.community_records set status = 'Sent' where id = $1", [ann]);
await db.query("update events.community_records set name = 'Doors!' where id = $1", [ann]);
const fan = await all("select * from events_push.fanouts");
eq(fan.length, 1, "one fan-out");
eq(fan[0].event_id, null, "bad audience event id tolerated");

// Chat: replies reach the parent author (Q&A answers are typed), organiser posts reach participants, throttled.
const chan = (await one("insert into events.chat_channels(project_id, event_id, kind, name) values ($1, $2, 'event', 'General') returning id", [project, event])).id;
for (const m of [ada, guest, boss]) await db.query("insert into events.chat_participants(channel_id, member_id) values ($1, $2)", [chan, m]);
const parent = (await one("insert into events.chat_messages(channel_id, author_member_id, body) values ($1, $2, 'q') returning id", [chan, ada])).id;
await db.query("insert into events.chat_messages(channel_id, author_member_id, body, metadata) values ($1, $2, 'a', $3)", [chan, guest, { replyTo: parent }]);
await db.query("insert into events.chat_messages(channel_id, author_member_id, body, metadata) values ($1, $2, 'self', $3)", [chan, ada, { replyTo: parent }]);
eq((await rows("chat_reply")).map((r) => r.member_id), [ada], "reply reaches the parent author, not self-replies");
await db.query("insert into events.chat_messages(channel_id, sender_kind, body) values ($1, 'organiser', 'post 1')", [chan]);
await db.query("insert into events.chat_messages(channel_id, sender_kind, body) values ($1, 'organiser', 'post 2')", [chan]);
eq((await rows("chat_organiser_post")).length, 3, "organiser post: one per participant, throttled");
const qa = (await one("insert into events.chat_channels(project_id, event_id, kind, name) values ($1, $2, 'qa', 'Ask') returning id", [project, event])).id;
const question = (await one("insert into events.chat_messages(channel_id, author_member_id, body) values ($1, $2, '?') returning id", [qa, guest])).id;
await db.query("insert into events.chat_messages(channel_id, sender_kind, body, metadata) values ($1, 'organiser', '!', $2)", [qa, { replyTo: question }]);
eq((await rows("qa_answer")).map((r) => r.member_id), [guest], "Q&A answer");

// enqueue_rows is idempotent on its dedupe key.
const planned = [{ member: ada, project, event, type: "event_starting", ref: { offset: 60 }, dedupe: `event_starting:${event}:60:${ada}`, sendAfter: new Date(Date.now() + 3600e3).toISOString() }];
eq((await one("select events_push.enqueue_rows($1) as n", [JSON.stringify(planned)])).n, 1, "planned row inserted");
eq((await one("select events_push.enqueue_rows($1) as n", [JSON.stringify(planned)])).n, 0, "planned row deduped");

// Claim: due rows only, leased; expired rows are skipped; has_work reflects the queue.
await db.query("update events_push.notifications set expires_at = now() - interval '1 minute' where type = 'checked_in'");
ok((await one("select events_push.has_work() as w")).w, "has work");
const claimed = await all("select * from events_push.claim(500)");
ok(claimed.length > 0 && claimed.every((r) => r.status === "sending" && r.attempts === 1 && r.lease_until), "claimed under a lease");
ok(!claimed.some((r) => r.type === "event_starting" || r.type === "event_changed" || r.type === "thread_reply"), "future rows wait");
eq((await rows("checked_in"))[0].skip_reason, "expired", "expired rows skipped");
eq((await all("select * from events_push.claim(500)")).length, 0, "leased rows aren't claimed twice");

// A dispatcher that died after Expo accepted: the row settles as sent rather than going out twice.
const [crashed, stuck] = claimed;
await db.query("update events_push.notifications set lease_until = now() - interval '1 second' where id = any($1)", [[crashed.id, stuck.id]]);
await db.query("insert into events_push.deliveries(notification_id, push_token, status) values ($1, 'ExponentPushToken[x]', 'ok')", [crashed.id]);
await db.query("update events_push.notifications set attempts = 8 where id = $1", [stuck.id]);
eq((await all("select id from events_push.claim(500)")).length, 0, "nothing re-claimed");
eq((await one("select status from events_push.notifications where id = $1", [crashed.id])).status, "sent", "crashed-after-send settles as sent");
eq((await one("select status from events_push.notifications where id = $1", [stuck.id])).status, "failed", "endless re-claims stop at 8 attempts");

// Fan-out claims count attempts for the retry cap.
eq((await one("select attempts from events_push.claim_fanouts(10)")).attempts, 1, "fan-out attempts counted");

// Scheduler status without pg_cron.
const status = (await one("select events_push.scheduler_status() as s")).s;
eq(status, { configured: false, globalPaused: false, jobs: [] }, "scheduler_status without cron");

// Service role only.
for (const role of ["anon", "authenticated"]) {
  await db.exec(`set role ${role}`);
  await assert.rejects(db.query("select * from events_push.notifications"), /permission denied/, `${role} denied`);
  assertions++;
  await db.exec("reset role");
}
// A client write to a source table still fires the trigger (definer rights) without schema access.
await db.exec("grant usage on schema events to anon; grant insert, select on events.portal_thread_messages to anon");
await db.exec("set role anon");
await db.query("insert into events.portal_thread_messages(thread_id, sender, body) values ($1, 'organiser', 'three')", [thread]);
await db.exec("reset role");
eq((await rows("thread_reply")).filter((r) => r.status === "queued").length, 1, "trigger fires for an anon write and supersedes");

console.log(`events_push migration verified (${assertions} assertions)`);
