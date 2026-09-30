import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

// An isolated PostgreSQL runtime; never connects to the configured Supabase.
if (!process.env.PGLITE_MODULE) {
  throw new Error("Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js path.");
}
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const eventId = "11111111-1111-4111-8111-111111111111";
const projectId = "22222222-2222-4222-8222-222222222222";
const userId = "33333333-3333-4333-8333-333333333333";
const spots = [{
  id: "spot", name: "Gold", quantity: 3, open: true, fills: [
    { id: "confirmed", sponsorId: "sponsor-one", status: "confirmed", amount: 125,
      note: "Private deal", enquiryId: "lead", sponsor: { name: "Confirmed" } },
    { id: "pending", sponsorId: "sponsor-two", status: "pending", amount: 50,
      note: "Private negotiation", sponsor: { name: "Pending" } },
  ],
}];
const migration = await readFile(new URL(
  "../supabase/migrations/20260930150932_private_sponsorship_fills.sql", import.meta.url,
), "utf8");
const legacyMerge = await readFile(new URL(
  "../supabase/migrations/20260715100716_events_meta.sql", import.meta.url,
), "utf8");
const enquiriesMigration = await readFile(new URL(
  "../supabase/migrations/20260929120000_sponsor_enquiries.sql", import.meta.url,
), "utf8");
const queryOne = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const noPrivateFields = (value) => {
  const json = JSON.stringify(value);
  for (const key of ["amount", "note", "enquiryId"]) assert.ok(!json.includes(`"${key}"`));
};

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role;
    create schema events; create schema auth;
    grant usage on schema events, auth to anon, authenticated, service_role;
    alter default privileges in schema events grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema events grant all on routines to anon, authenticated, service_role;
    create function auth.uid() returns uuid language sql stable as $$
      select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
    $$;
    create function events.can_access_project(target uuid) returns boolean language sql stable as $$
      select auth.uid() is not null and target = nullif(current_setting('test.project', true), '')::uuid;
    $$;
    create function events.touch_updated_at() returns trigger language plpgsql as $$
      begin new.updated_at = now(); return new; end;
    $$;
    create table events.events (id uuid primary key, project_id uuid, metadata jsonb not null,
      deleted_at timestamptz, visibility text default 'Public');
    alter table events.events enable row level security;
    create policy member_all on events.events for all to authenticated
      using (events.can_access_project(project_id)) with check (events.can_access_project(project_id));
    create policy public_read on events.events for select to anon, authenticated
      using (visibility <> 'Private' and deleted_at is null);
  `);
  await db.exec(legacyMerge.split("-- @up")[1]);
  await db.exec(enquiriesMigration.split("-- @up")[1].split("-- @down")[0]);
  await db.query("insert into events.events (id, project_id, metadata) values ($1, $2, $3)",
    [eventId, projectId, { sponsorship: { spots }, sponsorshipPage: { enabled: true } }]);
  await db.exec(migration.split("-- @up")[1].split("-- @down")[0]);
  const backfill = await queryOne("select spots from events.event_sponsorship");
  assert.deepEqual(backfill.spots, spots);

  await db.exec("set role anon");
  await assert.rejects(db.query("select * from events.event_sponsorship"), { code: "42501" });
  await assert.rejects(db.query("select events.save_event_sponsorship($1, $2)", [eventId, spots]), { code: "42501" });
  await assert.rejects(db.query("select events.event_merge_meta($1, $2)", [
    eventId, { sponsorsDisplay: { includePending: true } },
  ]), { code: "42501" });
  let published = (await queryOne("select metadata from events.events")).metadata;
  noPrivateFields(published.sponsorship);
  assert.equal(published.sponsorship.spots[0].fills.length, 1);
  assert.equal(published.sponsorship.spots[0].reserved, 2);
  assert.equal(published.sponsorship.spots[0].fills[0].sponsor.name, "Confirmed");
  await db.query("insert into events.sponsor_enquiries (event_id, project_id, email) values ($1, $2, $3)",
    [eventId, projectId, "prospect@example.test"]);
  await assert.rejects(db.query("insert into events.sponsor_enquiries (event_id, project_id, email) values ($1, $2, $3)",
    [eventId, userId, "spoof@example.test"]), { code: "42501" });
  assert.equal((await db.query("select * from events.sponsor_enquiries")).rows.length, 0);

  await db.exec("reset role; set role authenticated");
  await db.query("select set_config('request.jwt.claim.sub', $1, false), set_config('test.project', $2, false)", [userId, projectId]);
  assert.deepEqual((await queryOne("select spots from events.event_sponsorship")).spots, spots);
  const edited = structuredClone(spots);
  edited[0].fills[0].note = "Updated privately";
  edited[0].fills[0].amount = 200;
  assert.equal((await queryOne("select events.save_event_sponsorship($1, $2) as saved", [eventId, edited])).saved, true);
  assert.equal((await queryOne("select spots from events.event_sponsorship")).spots[0].fills[0].amount, 200);
  published = (await queryOne("select metadata from events.events")).metadata;
  noPrivateFields(published.sponsorship);
  assert.deepEqual(published.sponsorIds, ["sponsor-one"]);

  await db.query("select events.event_merge_meta($1, $2)", [eventId, {
    sponsorsDisplay: { includePending: true }, sponsorship: { spots },
  }]);
  published = (await queryOne("select metadata from events.events")).metadata;
  noPrivateFields(published.sponsorship);
  assert.equal(published.sponsorship.spots[0].fills.length, 2);
  await db.query("select events.event_merge_meta($1, $2)", [eventId, { sponsorshipPage: { enabled: false } }]);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("insert into events.sponsor_enquiries (event_id, project_id, email) values ($1, $2, $3)",
    [eventId, projectId, "disabled@example.test"]), { code: "42501" });
  await db.exec("reset role; set role authenticated");
  await db.query("select events.event_merge_meta($1, $2)", [eventId, {
    sponsorshipPage: { enabled: true, formEnabled: false },
  }]);
  await db.exec("reset role; set role anon");
  await assert.rejects(db.query("insert into events.sponsor_enquiries (event_id, project_id, email) values ($1, $2, $3)",
    [eventId, projectId, "disabled-form@example.test"]), { code: "42501" });
  await db.exec("reset role; set role authenticated");
  await assert.rejects(db.query("select events.save_event_sponsorship($1, $2)", [eventId, {}]), { code: "22023" });
  await assert.rejects(db.query("update events.event_sponsorship set spots = '[]'"), { code: "42501" });

  await db.query("select set_config('test.project', $1, false)", [userId]);
  assert.equal((await db.query("select * from events.event_sponsorship")).rows.length, 0);
  await assert.rejects(db.query("select events.save_event_sponsorship($1, $2)", [eventId, []]), { code: "42501" });
  await assert.rejects(db.query("select events.event_merge_meta($1, $2)", [eventId, {}]), { code: "42501" });

  await db.exec("reset role");
  await db.query("delete from events.events where id = $1", [eventId]);
  assert.equal((await db.query("select * from events.event_sponsorship")).rows.length, 0);
  console.log("PASS: backfill, anonymous privacy, member save, public projection, generic RPC guard, enquiry scope, RLS, invalid input and cascade.");
} finally {
  await db.close();
}
