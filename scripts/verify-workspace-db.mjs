import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";
import { randomUUID } from "node:crypto";

// Isolated PGlite check of the Operations retirement and the Workspace migrations. Set PGLITE_MODULE to
// an installed @electric-sql/pglite dist/index.js; never touches a real database.
const runtime = process.env.PGLITE_MODULE;
if (!runtime) throw new Error("Set PGLITE_MODULE to an installed @electric-sql/pglite dist/index.js");
const { PGlite } = await import(pathToFileURL(runtime).href);
const db = new PGlite();

let assertions = 0;
const ok = (value, message) => { assert.ok(value, message); assertions++; };
const eq = (actual, expected, message) => { assert.deepEqual(actual, expected, message); assertions++; };
const rejects = async (promise, code, message) => { await assert.rejects(promise, (error) => error.code === code || (console.error(message, error.code, error.message), false), message); assertions++; };
const one = async (sql, values = []) => (await db.query(sql, values)).rows[0];
const all = async (sql, values = []) => (await db.query(sql, values)).rows;
const apply = async (filename) => {
  const text = await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8");
  await db.exec(text.split("-- @up")[1]?.split("-- @down")[0] ?? text);
};

const project = randomUUID(), otherProject = randomUUID(), event = randomUUID(), otherEvent = randomUUID();
const venue = randomUUID(), otherVenue = randomUUID();
const owner = randomUUID(), viewer = randomUUID(), outsider = randomUUID();

await db.exec(`
  create role anon; create role authenticated; create role service_role bypassrls;
  create schema events; create schema storage; create schema auth;
  grant usage on schema events to anon, authenticated, service_role;
  alter default privileges in schema events grant all on tables to anon, authenticated, service_role;
  alter default privileges in schema events grant all on routines to anon, authenticated, service_role;
  create function auth.uid() returns uuid language sql stable as $$ select null::uuid $$;
  create table storage.buckets(id text primary key, name text, public boolean, file_size_limit bigint);
  create table storage.objects(id uuid primary key default gen_random_uuid(), bucket_id text, name text);
  create table public.projects(id uuid primary key, created_by uuid, organization_id uuid);
  create table public.organization_users(organization uuid, "user" uuid, role text);
  create table public.roles(id uuid primary key, project_id uuid, key text, permissions text[] not null default '{}', deleted_at timestamptz);
  create table events.role_grants(id uuid primary key default gen_random_uuid(), project_id uuid, user_id uuid, role_id uuid, status text, scope jsonb default '{}', deleted_at timestamptz);
  create function public.rbac_key_matches(keys text[], wanted text) returns boolean language sql immutable as $$
    select exists(select 1 from unnest(keys) k where k = wanted or k = '*' or (right(k, 2) = '.*' and wanted like left(k, length(k) - 1) || '%')) $$;
  create table events.events(id uuid primary key, project_id uuid, venue_id uuid, name text, timezone text default 'UTC', deleted_at timestamptz);
  create table events.contacts(id uuid primary key, project_id uuid, name text, email text, deleted_at timestamptz);
  create table events.registrations(id uuid primary key, event_id uuid, name text, email text, deleted_at timestamptz);
  create table events.checkin_attendance(id uuid primary key default gen_random_uuid(), event_id uuid, project_id uuid, registration_id uuid, order_id uuid,
    attendee_name text not null default '', ticket_code text, gate text, zone text, session_id text, method text not null default 'manual',
    status text not null default 'in', checked_in_at timestamptz not null default now(), created_at timestamptz not null default now(), deleted_at timestamptz);
  create table events.event_orders(id uuid primary key, event_id uuid, buyer_name text, buyer_email text);
  create table events.project_members(id uuid primary key, project_id uuid, name text, email text, deleted_at timestamptz);
  create table events.venue_spaces(id uuid primary key, project_id uuid, venue_id uuid, name text, deleted_at timestamptz);
  create table events.api_keys(id uuid primary key default gen_random_uuid(), project_id uuid, name text, prefix text, key_hash text,
    scopes text[] not null default '{}', revoked_at timestamptz, deleted_at timestamptz,
    constraint api_keys_scopes_check check (scopes <@ array['read:events', 'read:orders', 'read:attendees', 'read:checkins', 'write:checkins']::text[]));
`);

// Stand-ins for what the Operations migrations left behind, including the role guards that must survive.
await db.exec(`
  create unique index ops_events_event_project_uq on events.events (id, project_id);
  create table events.ops_workspaces(project_id uuid, event_id uuid);
  create table events.ops_entities(id uuid primary key);
  create function events.ops_workflow_command(a uuid, b jsonb) returns jsonb language sql as $$ select '{}'::jsonb $$;
  create function events.ops_public_programme(a uuid) returns jsonb language sql as $$ select null::jsonb $$;
  create function events.ops_can_administer_roles(a uuid) returns boolean language sql as $$ select true $$;
  create function events.ops_check_role_grant_project() returns trigger language plpgsql as $$ begin return new; end $$;
  create function events.ops_private_ensure_membership(a uuid, b uuid) returns uuid language sql as $$ select a $$;
  create function events.ops_private_sync_project_team(a uuid) returns void language sql as $$ select $$;
  insert into storage.buckets values ('operations', 'operations', false, 1);
  insert into storage.objects(bucket_id, name) values ('operations', 'a.pdf');
`);
const ownerRole = randomUUID(), viewerRole = randomUUID(), legacyRole = randomUUID();
await db.query("insert into public.projects values ($1,$2,null), ($3,$4,null)", [project, owner, otherProject, outsider]);
await db.query("insert into events.events(id, project_id, venue_id) values ($1,$2,$3), ($4,$2,$5)", [event, project, venue, otherEvent, otherVenue]);
await db.query(`insert into public.roles(id, project_id, key, permissions) values
  ($1, $4, 'owner', array['events.workspace.*']),
  ($2, $4, 'viewer', array['events.workspace.view']),
  ($3, $4, 'legacy', array['events.events.view','events.operations.view','events.operations.records.create','events.operations.record_archive','events.operations.notices'])`,
[ownerRole, viewerRole, legacyRole, project]);
await db.query("insert into public.organization_users values (null, $1, 'member')", [viewer]);
await db.query("update public.projects set organization_id = $1 where id = $2", [randomUUID(), project]);
const org = (await one("select organization_id from public.projects where id = $1", [project])).organization_id;
await db.query("insert into public.organization_users values ($1,$2,'owner'), ($1,$3,'member')", [org, owner, viewer]);
await db.query("insert into events.role_grants(project_id, user_id, role_id, status) values ($1,$2,$3,'active'), ($1,$4,$5,'active')", [project, owner, ownerRole, viewer, viewerRole]);

// Retirement
await apply("20261114100000_retire_operations.sql");
eq((await all("select tablename from pg_tables where schemaname = 'events' and tablename like 'ops\\_%'")).length, 0, "ops tables dropped");
const kept = (await all("select proname from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'events' and proname like 'ops\\_%' order by proname")).map((row) => row.proname);
eq(kept, ["ops_can_administer_roles", "ops_check_role_grant_project", "ops_private_ensure_membership", "ops_private_sync_project_team"], "only role guards survive");
eq(await one("select to_regclass('events.ops_events_event_project_uq') as idx"), { idx: null }, "old event index dropped");
eq((await all("select id from storage.buckets where id = 'operations'")).length, 0, "operations bucket removed");
eq((await one("select permissions from public.roles where id = $1", [legacyRole])).permissions.sort(),
  ["events.events.view", "events.workspace.record_create", "events.workspace.record_delete", "events.workspace.view"], "legacy permissions rewritten");

// Foundation
await apply("20261114110000_workspace_foundation.sql");
eq((await one("select public, file_size_limit from storage.buckets where id = 'workspace'")), { public: false, file_size_limit: 52428800 }, "private workspace bucket");
for (const role of ["anon", "authenticated"]) {
  await db.exec(`set role ${role}`);
  await rejects(db.query("select * from events.workspace_records"), "42501", `${role} cannot read records`);
  await rejects(db.query("select events.workspace_can($1,$2,$3,'events.workspace.view')", [project, event, owner]), "42501", `${role} cannot call workspace_can`);
  await db.exec("reset role");
}
const can = async (actor, key, ev = event, proj = project) => (await one("select events.workspace_can($1,$2,$3,$4) as ok", [proj, ev, actor, key])).ok;
ok(await can(owner, "events.workspace.configure"), "owner can configure");
ok(await can(viewer, "events.workspace.view"), "viewer can view");
ok(!await can(viewer, "events.workspace.configure"), "viewer cannot configure");
ok(!await can(outsider, "events.workspace.view"), "outsider cannot view");
await db.query("update events.role_grants set scope = jsonb_build_object('event', jsonb_build_array($1::text)) where user_id = $2", [otherEvent, viewer]);
ok(!await can(viewer, "events.workspace.view"), "event-scoped grant excludes other events");
ok(await can(viewer, "events.workspace.view", otherEvent), "event-scoped grant covers its event");
await db.query("update events.role_grants set scope = '{}' where user_id = $1", [viewer]);

const commandMigration = new URL("../supabase/migrations/20261114120000_workspace_command.sql", import.meta.url);
let hasCommands = true;
try { await readFile(commandMigration); } catch { hasCommands = false; }
if (hasCommands) {
  const { verifyCommands } = await import("./verify-workspace-commands.mjs");
  await apply("20261114120000_workspace_command.sql");
  // The portals migration replaces the read functions, so the Foundation checks run against both, then down and up again.
  const portals = "20261115100000_workspace_portals.sql";
  const hasPortals = await readFile(new URL(`../supabase/migrations/${portals}`, import.meta.url)).then(() => true, () => false);
  if (hasPortals) {
    await apply(portals);
    const text = await readFile(new URL(`../supabase/migrations/${portals}`, import.meta.url), "utf8");
    await db.exec(text.split("-- @down")[1]);
    eq(await one("select to_regclass('events.workspace_roles') as t"), { t: null }, "portals down removes its tables");
    await apply(portals);
  }
  assertions += await verifyCommands({ db, one, all, project, otherProject, event, otherEvent, venue, otherVenue, owner, viewer, outsider });
  if (hasPortals) {
    const { verifyPortal } = await import("./verify-workspace-portal-db.mjs");
    assertions += await verifyPortal({ db, one, all, project, event, owner, viewer });
  }
  // Later sub-projects: each migration goes up, down and up again before its checks run on a fresh event.
  for (const [filename, script, name, table] of [
    ["20261116100000_workspace_process.sql", "./verify-workspace-process-db.mjs", "verifyProcess", "workspace_automations"],
    ["20261117100000_workspace_documents.sql", "./verify-workspace-documents-db.mjs", "verifyDocuments", "workspace_certificates"],
    ["20261118100000_workspace_components.sql", "./verify-workspace-components-db.mjs", "verifyComponents", null],
    ["20261119100000_workspace_openness.sql", "./verify-workspace-openness-db.mjs", "verifyOpenness", null],
  ]) {
    if (!hasPortals || !(await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url)).then(() => true, () => false))) break;
    await apply(filename);
    const text = await readFile(new URL(`../supabase/migrations/${filename}`, import.meta.url), "utf8");
    await db.exec(text.split("-- @down")[1]);
    if (table) eq(await one(`select to_regclass('events.${table}') as t`), { t: null }, `${filename} down removes its tables`);
    await apply(filename);
    const verify = (await import(script))[name];
    assertions += await verify({ db, one, all, project, otherProject, owner, viewer });
  }
  // Board order shipped without an @up marker, so geiger-orm ran it whole (its @down too); the fix migration repairs that.
  const boardFix = "20261121100000_workspace_board_order_fix.sql";
  if (hasPortals && await readFile(new URL(`../supabase/migrations/${boardFix}`, import.meta.url)).then(() => true, () => false)) {
    await apply("20261120100000_workspace_board_order.sql");
    await apply(boardFix);
    const text = await readFile(new URL(`../supabase/migrations/${boardFix}`, import.meta.url), "utf8");
    await db.exec(text.split("-- @down")[1]);
    eq(await one("select to_regclass('events.workspace_records_rank_idx') as t"), { t: null }, "board order fix down removes the rank index");
    await apply(boardFix);
    const { verifyBoardOrder } = await import("./verify-workspace-board-order-db.mjs");
    assertions += await verifyBoardOrder({ db, one, project, owner });
  }
}

console.log(`verify-workspace-db: ${assertions} assertions passed`);
