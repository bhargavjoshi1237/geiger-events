import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import { pathToFileURL } from "node:url";

if (!process.env.PGLITE_MODULE) {
  throw new Error("Set PGLITE_MODULE to an installed @electric-sql/pglite/dist/index.js path.");
}
const { PGlite } = await import(pathToFileURL(process.env.PGLITE_MODULE).href);
const db = new PGlite();
const project = "11111111-1111-4111-8111-111111111111";
const event = "22222222-2222-4222-8222-222222222222";
const otherProject = "33333333-3333-4333-8333-333333333333";
const otherEvent = "44444444-4444-4444-8444-444444444444";
const actor = "55555555-5555-4555-8555-555555555555";
const commandId = "66666666-6666-4666-8666-666666666666";
const moduleDefinition = {
  key: "vendor-inspection", version: 1, label: "Vendor inspection", sourceKind: "custom",
  capabilities: ["records", "forms"], enabled: true,
  fields: [{ id: "name", label: "Name", type: "text", required: true }],
  states: [{ key: "new", label: "New" }, { key: "complete", label: "Complete" }],
  transitions: [{ from: "new", to: "complete" }], views: ["table"],
};
const modules = [moduleDefinition];
const queryOne = async (sql, params = []) => (await db.query(sql, params)).rows[0];
const sql = await readFile(new URL(
  "../supabase/migrations/20260930160740_operations_foundation.sql", import.meta.url,
), "utf8");
const permissionsSql = await readFile(new URL(
  "../supabase/migrations/20260930163920_operations_permission_backfill.sql", import.meta.url,
), "utf8");
const recordReadsSql = await readFile(new URL(
  "../supabase/migrations/20260930165200_operations_record_reads.sql", import.meta.url,
), "utf8");

try {
  await db.exec(`
    create role anon; create role authenticated; create role service_role bypassrls;
    create schema events; grant usage on schema events to anon, authenticated, service_role;
    alter default privileges in schema events grant all on tables to anon, authenticated, service_role;
    alter default privileges in schema events grant all on routines to anon, authenticated, service_role;
    create table events.events (id uuid primary key, project_id uuid, deleted_at timestamptz);
    grant select on events.events to service_role;
  `);
  await db.query("insert into events.events (id, project_id) values ($1, $2), ($3, $4)",
    [event, project, otherEvent, otherProject]);
  await db.exec(sql.split("-- @up")[1].split("-- @down")[0]);
  await db.exec(recordReadsSql.split("-- @up")[1].split("-- @down")[0]);
  await db.exec(`create table public.roles (
    id uuid primary key, key text, is_system boolean, deleted_at timestamptz, permissions text[]
  );
  insert into public.roles (id,key,is_system,permissions) values
    ('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa','manager',true,array['events.event.edit']),
    ('bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb','member',true,array['events.event.edit']),
    ('cccccccc-cccc-4ccc-8ccc-cccccccccccc','custom',false,array['events.event.edit']);`);
  await db.exec(permissionsSql.split("-- @up")[1].split("-- @down")[0]);
  const permissions = await db.query("select key,permissions from public.roles order by key");
  assert.equal(permissions.rows.find((r) => r.key === "manager").permissions.includes("events.operations.configure"), true);
  assert.equal(permissions.rows.find((r) => r.key === "member").permissions.includes("events.operations.view"), false);
  assert.equal(permissions.rows.find((r) => r.key === "custom").permissions.includes("events.operations.view"), false);

  for (const role of ["anon", "authenticated"]) {
    await db.exec(`set role ${role}`);
    await assert.rejects(db.query("select * from events.ops_workspaces"), { code: "42501" });
    await assert.rejects(db.query("select * from events.ops_entities"), { code: "42501" });
    await assert.rejects(db.query("select events.ops_publish_workspace($1,$2,$3,$4,$5,$6,$7)",
      [project, event, actor, 0, modules, commandId, "hash"]), { code: "42501" });
    await assert.rejects(db.query("select * from events.ops_list_records($1,$2,'vendor-inspection',null,null,null,25,false)",
      [project, event]), { code: "42501" });
    await db.exec("reset role");
  }
  await db.exec("set role service_role");
  await assert.rejects(db.query("select events.ops_save_workspace_draft($1,$2,$3,$4,$5)",
    [otherProject, event, actor, 0, modules]), { code: "23503" });
  const draft = await queryOne("select events.ops_save_workspace_draft($1,$2,$3,$4,$5) as value",
    [project, event, actor, 0, modules]);
  assert.equal(draft.value.revision, 1);
  assert.equal(draft.value.status, "draft");
  const publish = await queryOne("select events.ops_publish_workspace($1,$2,$3,$4,$5,$6,$7) as value",
    [project, event, actor, 1, modules, commandId, "publish-1"]);
  assert.equal(publish.value.publishedVersion, 1);
  assert.equal(publish.value.revision, 2);
  assert.equal((await queryOne("select count(*)::int as count from events.ops_module_versions")).count, 1);
  await assert.rejects(db.query("update events.ops_audit set changes = '{}' where action = 'publish'"),
    { code: "42501" });
  await assert.rejects(db.query("delete from events.ops_workspace_versions where version = 1"),
    { code: "42501" });
  await assert.rejects(db.query("update events.ops_command_receipts set request_hash = 'forged'"),
    { code: "42501" });
  await assert.rejects(db.query("select events.ops_publish_workspace($1,$2,$3,$4,$5,$6,$7)",
    [project, event, actor, 1, modules,
      "77777777-7777-4777-8777-777777777777", "publish-2"]), { code: "40001" });

  const create = {
    action: "create", moduleKey: "vendor-inspection", definitionVersion: 1,
    title: "Vendor A", values: { name: "Vendor A" }, references: [],
    commandId: "88888888-8888-4888-8888-888888888888", requestHash: "create-1",
  };
  const record = (await queryOne("select events.ops_mutate_record($1,$2,$3,$4) as value",
    [project, event, actor, create])).value;
  assert.equal(record.revision, 1);
  assert.equal(record.values.name, "Vendor A");
  const replay = (await queryOne("select events.ops_mutate_record($1,$2,$3,$4) as value",
    [project, event, actor, create])).value;
  assert.deepEqual(replay, record);
  assert.equal((await queryOne("select count(*)::int as count from events.ops_audit where action = 'create'")).count, 1);
  await assert.rejects(db.query("select events.ops_mutate_record($1,$2,$3,$4)",
    [project, event, actor, { ...create, requestHash: "changed" }]), { code: "23505" });
  await assert.rejects(db.query("select events.ops_mutate_record($1,$2,$3,$4)",
    [project, event, actor, { ...create, action: "update", recordId: record.id,
      expectedRevision: 0, commandId: "99999999-9999-4999-8999-999999999999", requestHash: "stale" }]),
  { code: "40001" });

  const update = {
    ...create, action: "update", recordId: record.id, expectedRevision: 1,
    title: "Vendor B", values: { name: "Vendor B" },
    commandId: "aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa", requestHash: "update-1",
  };
  const updated = (await queryOne("select events.ops_mutate_record($1,$2,$3,$4) as value",
    [project, event, actor, update])).value;
  assert.equal(updated.revision, 2);
  assert.equal(updated.values.name, "Vendor B");
  const listed = await db.query("select * from events.ops_list_records($1,$2,'vendor-inspection',null,null,null,25,false)",
    [project, event]);
  assert.equal(listed.rows.length, 1);
  assert.equal(listed.rows[0].ops_list_records.values.name, "Vendor B");

  await db.exec("reset role");
  await db.exec(`
    create function events.test_block_audit() returns trigger language plpgsql as $$
    begin raise exception 'Audit intentionally failed'; end; $$;
    create trigger ops_audit_fail before insert on events.ops_audit
      for each row execute function events.test_block_audit();
  `);
  await db.exec("set role service_role");
  await assert.rejects(db.query("select events.ops_mutate_record($1,$2,$3,$4)",
    [project, event, actor, { ...update, expectedRevision: 2,
      commandId: "bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb", requestHash: "audit-fail" }]));
  await db.exec("reset role; drop trigger ops_audit_fail on events.ops_audit; set role service_role");
  assert.equal((await queryOne("select revision from events.ops_entities where id = $1", [record.id])).revision, 2);
  assert.equal((await queryOne("select count(*)::int as count from events.ops_command_receipts where request_hash = 'audit-fail'")).count, 0);

  await db.query("select events.ops_save_workspace_draft($1,$2,$3,$4,$5)",
    [otherProject, otherEvent, actor, 0, modules]);
  await db.query("select events.ops_publish_workspace($1,$2,$3,$4,$5,$6,$7)",
    [otherProject, otherEvent, actor, 1, modules,
      "cccccccc-cccc-4ccc-8ccc-cccccccccccc", "publish-other"]);
  const other = (await queryOne("select events.ops_mutate_record($1,$2,$3,$4) as value",
    [otherProject, otherEvent, actor, { ...create,
      commandId: "dddddddd-dddd-4ddd-8ddd-dddddddddddd", requestHash: "other" }])).value;
  await assert.rejects(db.query("insert into events.ops_entity_links (project_id,event_id,source_entity_id,target_entity_id,field_id) values ($1,$2,$3,$4,'owner')",
    [project, event, record.id, other.id]), { code: "23503" });
  await assert.rejects(db.query("insert into events.ops_entities (id,project_id,event_id,module_key,definition_version,title,state) values ($1,$2,$3,'vendor-inspection',1,'Duplicate','new')",
    [record.id, project, event]), { code: "23505" });

  await db.exec("reset role");
  console.log("PASS: private grants, parent scope, publish version, stale revision, replay, audit rollback, cross-event links and unique identities.");
} finally {
  await db.close();
}
