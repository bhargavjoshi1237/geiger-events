import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

if (!process.env.PGLITE_MODULE) throw new Error("Set PGLITE_MODULE to the existing external PGlite runtime.");
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const owner = "11111111-1111-4111-8111-111111111111";
const member = "22222222-2222-4222-8222-222222222222";
const orgAdmin = "33333333-3333-4333-8333-333333333333";
const project = "44444444-4444-4444-8444-444444444444";
const other = "55555555-5555-4555-8555-555555555555";
const role = "66666666-6666-4666-8666-666666666666";
const ownerRole = "88888888-8888-4888-8888-888888888888";
const outsider = "99999999-9999-4999-8999-999999999999";
const org = "77777777-7777-4777-8777-777777777777";
try {
  await db.exec(`create role anon; create role authenticated; create role service_role bypassrls;
    create schema events; create schema auth;
    create function auth.uid() returns uuid language sql stable as
      'select nullif(current_setting(''request.jwt.claim.sub'', true), '''')::uuid';
    create table public.projects(id uuid primary key,created_by uuid,organization_id uuid);
    create table public.organization_users("user" uuid,"organization" uuid,role text);
    create table auth.users(id uuid primary key,email text,raw_user_meta_data jsonb default '{}');
    create table public.roles(id uuid primary key default gen_random_uuid(),project_id uuid,permissions text[],key text,deleted_at timestamptz);
    create table events.role_grants(id uuid primary key default gen_random_uuid(),project_id uuid,user_id uuid,role_id uuid,scope jsonb default '{}',status text default 'active',deleted_at timestamptz,unique(project_id,user_id));
    create table events.project_members(id uuid primary key default gen_random_uuid(),project_id uuid,user_id uuid,role_id uuid,status text,email text,name text,avatar_url text,joined_at timestamptz,deleted_at timestamptz);
    grant usage on schema events,auth to authenticated,service_role;
    grant all on public.roles,events.role_grants,events.project_members to authenticated,service_role;
    alter table public.roles enable row level security; alter table events.role_grants enable row level security;
    create policy roles_read on public.roles for select to authenticated using (true);
    create policy roles_write on public.roles for all to authenticated using (true) with check (true);
    create policy role_grants_write on events.role_grants for all to authenticated using (true) with check (true);
    alter table events.project_members enable row level security;
    create policy roster_write on events.project_members for all to authenticated using (true) with check (true);
    create function events.can_access_project(uuid) returns boolean language sql as 'select true';`);
  await db.query("insert into public.projects values ($1,$2,$3),($4,$5,null)", [project, owner, org, other, member]);
  await db.query("insert into public.organization_users values ($1,$2,'admin'),($3,$2,'member'),($4,$2,'owner')", [orgAdmin, org, member, owner]);
  // Load the REAL deployed helper bodies; stubbing these hides first-joiner escalation.
  const upstream = await readFile(new URL("../supabase/migrations/20260809135817_rbac_org_role_mapping.sql", import.meta.url), "utf8");
  for (const name of ["rbac_role_for_member", "rbac_ensure_membership", "sync_project_team"]) {
    const start = upstream.indexOf(`create or replace function events.${name}(`);
    await db.exec(upstream.slice(start, upstream.indexOf("\n$$;", start) + 4));
  }
  await db.query("insert into auth.users(id,email) values ($1,'member@example.test'),($2,'owner@example.test'),($3,'admin@example.test'),($4,'outside@example.test')", [member,owner,orgAdmin,outsider]);
  await db.query("insert into public.roles(id,project_id,permissions,key) values ($1,$2,array['events.operations.view'],'member'),($3,$2,array['*'],'owner')", [role, project, ownerRole]);
  const migration = await readFile(new URL("../supabase/migrations/20261002091000_operations_role_write_guards.sql", import.meta.url), "utf8");
  await db.exec(migration.split("-- @up")[1]);
  const asUser = async (id) => { await db.exec("reset role"); await db.query("select set_config('request.jwt.claim.sub',$1,false)", [id]); await db.exec("set role authenticated"); };
  await asUser(member);
  assert.equal((await db.query("select events.rbac_ensure_membership($1,$2) as result", [project, ownerRole])).rows[0].result,
    role, "first org member retains canonical Member despite caller default Owner and no project grants");
  assert.equal((await db.query("select role_id from events.project_members where user_id=$1",[member])).rows[0].role_id,role);
  await assert.rejects(db.query("insert into events.project_members(project_id,role_id,status,email) values($1,$2,'invited','outside@example.test')",[project,ownerRole]),{code:"42501"});
  await assert.rejects(db.query("select events.sync_project_team($1,$2)", [project, role]), { code: "42501" });
  await assert.rejects(db.query("select events.ops_private_ensure_membership($1,$2)", [project, role]), { code: "42501" });
  assert.equal((await db.query("select * from public.roles")).rows.length, 2, "members retain role reads");
  assert.equal((await db.query("update public.roles set permissions=array['*'] returning id")).rows.length, 0, "member escalation denied");
  await assert.rejects(db.query("insert into public.roles(project_id,permissions) values ($1,array['*'])", [project]), { code: "42501" });
  await assert.rejects(db.query("insert into events.role_grants(project_id,user_id,role_id) values ($1,$2,$3)", [project, member, role]), { code: "42501" });
  await db.exec("reset role");
  await db.query("update public.organization_users set role='member' where \"user\"=$1",[owner]);
  await asUser(owner);
  assert.equal((await db.query("update public.roles set permissions=array['*'] returning id")).rows.length,0,"org project creator is not canonical role administrator");
  await db.exec("reset role");
  await db.query("update public.organization_users set role='owner' where \"user\"=$1",[owner]);
  await asUser(owner);
  assert.equal((await db.query("update public.roles set permissions=array['events.operations.configure'] returning id")).rows.length, 2);
  await db.query("insert into events.role_grants(project_id,user_id,role_id) values ($1,$2,$3)", [project, orgAdmin, role]);
  await assert.rejects(db.query("update public.roles set project_id=$1 where id=$2", [other, role]), { code: "42501" });
  await asUser(orgAdmin);
  assert.equal((await db.query("update public.roles set permissions=array['events.operations.view'] returning id")).rows.length, 2);
  await assert.rejects(db.query("insert into events.role_grants(project_id,user_id,role_id) values ($1,$2,$3)", [other, member, role]), { code: "23503" });
  // Revocation remains a deliberate denial; self onboarding cannot restore it.
  await db.query("update events.role_grants set status='revoked' where user_id=$1",[member]);
  await asUser(member);
  assert.equal((await db.query("select events.rbac_ensure_membership($1,$2) result",[project,ownerRole])).rows[0].result,null);
  await asUser(outsider);
  assert.equal((await db.query("select events.rbac_ensure_membership($1,$2) result",[project,ownerRole])).rows[0].result,null,"nonmember cannot choose caller default or claim ownerless workspace");
  await asUser(owner);
  assert.equal((await db.query("select events.rbac_ensure_membership($1,null) result",[project])).rows[0].result,ownerRole,"real creator can bootstrap ownership");
  await db.query("insert into events.project_members(project_id,role_id,status,email) values($1,$2,'invited','outside@example.test')",[project,role]);
  await asUser(outsider);
  assert.equal((await db.query("select events.rbac_ensure_membership($1,$2) result",[project,ownerRole])).rows[0].result,role,"admin-created invite can grant its declared role only");
  await asUser(member);
  assert.equal((await db.query("delete from events.role_grants returning id")).rows.length, 0);
  await db.exec("reset role; set role service_role");
  assert.equal((await db.query("update public.roles set permissions=array['*'] returning id")).rows.length, 2);
  process.stdout.write("PASS: actual upstream onboarding, first-joiner/default escalation denied, canonical owner and explicit invite retained, revoked grant denied; member read retained; role/grant escalation denied; owner/admin/service writes; cross-project role binding denied.\n");
} finally { await db.close(); }
